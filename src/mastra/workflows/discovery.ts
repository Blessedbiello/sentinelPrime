import { createWorkflow, createStep } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/di';
import { z } from 'zod';
import { discoverListingsTool } from '../tools/index.js';
import { scoutAgent } from '../agents/scout.js';

const listingSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  type: z.string().optional(),
  rewardAmount: z.number().optional(),
  deadline: z.string().optional(),
  agentAccess: z.string().optional(),
});

// Step 1: Fetch live listings from Superteam API
const fetchListings = createStep({
  id: 'fetch-listings',
  inputSchema: z.object({
    take: z.number().default(20),
    deadline: z.string().optional(),
  }),
  outputSchema: z.object({
    listings: z.array(listingSchema),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();
    const result = await discoverListingsTool.execute(
      { context: { take: inputData.take, deadline: inputData.deadline }, runtimeContext },
    );
    return { listings: result.listings || [] };
  },
});

// Step 2: Scout agent analyzes and ranks the listings
const analyzeAndRank = createStep({
  id: 'analyze-and-rank',
  inputSchema: z.object({
    listings: z.array(listingSchema),
  }),
  outputSchema: z.object({
    rankedListings: z.array(
      listingSchema.extend({
        rank: z.number(),
        reasoning: z.string(),
        recommended: z.boolean(),
      }),
    ),
  }),
  execute: async ({ inputData }) => {
    if (inputData.listings.length === 0) {
      return { rankedListings: [] };
    }

    const prompt = [
      'Analyze and rank these Superteam Earn bounties by feasibility and value.',
      'Consider: reward amount, deadline proximity, bounty type (we excel at dev and analysis),',
      'and clarity of requirements.',
      '',
      'Listings:',
      JSON.stringify(inputData.listings, null, 2),
      '',
      'Return a JSON array with each listing plus rank (1=best), reasoning, and recommended (boolean).',
      'Only output valid JSON, no markdown.',
    ].join('\n');

    const response = await scoutAgent.generate(prompt);

    try {
      const parsed = JSON.parse(response.text);
      return { rankedListings: Array.isArray(parsed) ? parsed : [] };
    } catch {
      // Fallback: return listings with default ranking
      const ranked = inputData.listings.map((l, i) => ({
        ...l,
        rank: i + 1,
        reasoning: 'Auto-ranked by position',
        recommended: i < 3,
      }));
      return { rankedListings: ranked };
    }
  },
});

// Step 3: Present to human for selection (suspend)
const presentToHuman = createStep({
  id: 'present-to-human',
  inputSchema: z.object({
    rankedListings: z.array(
      listingSchema.extend({
        rank: z.number(),
        reasoning: z.string(),
        recommended: z.boolean(),
      }),
    ),
  }),
  outputSchema: z.object({
    selectedSlugs: z.array(z.string()),
  }),
  resumeSchema: z.object({
    selectedSlugs: z.array(z.string()),
  }),
  suspendSchema: z.object({
    rankedListings: z.array(z.unknown()),
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData?.selectedSlugs) {
      return { selectedSlugs: resumeData.selectedSlugs };
    }

    await suspend({
      rankedListings: inputData.rankedListings,
      message:
        'Review the ranked bounties above and provide selectedSlugs array to resume.',
    });

    return { selectedSlugs: [] };
  },
});

export const discoveryWorkflow = createWorkflow({
  id: 'discovery-workflow',
  inputSchema: z.object({
    take: z.number().default(20),
    deadline: z.string().optional(),
  }),
  outputSchema: z.object({
    selectedSlugs: z.array(z.string()),
  }),
})
  .then(fetchListings)
  .then(analyzeAndRank)
  .then(presentToHuman)
  .commit();
