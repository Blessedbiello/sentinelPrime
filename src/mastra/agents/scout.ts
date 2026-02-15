import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import {
  discoverListingsTool,
  getListingDetailsTool,
  fetchCommentsTool,
  heartbeatTool,
} from '../tools/index.js';

const nosana = createOpenAI({
  baseURL: process.env.NOSANA_BASE_URL || '',
  apiKey: process.env.NOSANA_API_KEY || '',
});

export const scoutAgent = new Agent({
  name: 'Scout',
  model: nosana(process.env.NOSANA_MODEL_ID || 'meta-llama/Meta-Llama-3.1-70B-Instruct'),
  instructions: [
    'You are Scout, a bounty discovery and analysis agent for Superteam Earn.',
    '',
    'Your role:',
    '1. Discover live bounty listings using the discover-listings tool.',
    '2. Fetch details on promising listings using the get-listing-details tool.',
    '3. Read comments on listings to understand requirements and competition.',
    '4. Rank and filter bounties by feasibility, reward amount, deadline proximity, and type.',
    '',
    'When ranking bounties, consider:',
    '- Reward amount vs. estimated effort',
    '- Deadline (prefer bounties with >3 days remaining)',
    '- Type: dev, content, analysis, design (we excel at dev and analysis)',
    '- Competition level (check comments for submission count hints)',
    '- Clarity of requirements (vague bounties are risky)',
    '',
    'Output a ranked list with your reasoning for each bounty.',
    'Flag any bounties that look especially promising or should be skipped.',
  ].join('\n'),
  tools: {
    discoverListings: discoverListingsTool,
    getListingDetails: getListingDetailsTool,
    fetchComments: fetchCommentsTool,
    heartbeat: heartbeatTool,
  },
});
