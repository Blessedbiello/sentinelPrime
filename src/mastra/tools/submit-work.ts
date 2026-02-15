import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';

export const submitWorkTool = createTool({
  id: 'submit-work',
  description: 'Submit work for a bounty listing on Superteam Earn.',
  inputSchema: z.object({
    listingId: z.string().describe('Listing ID'),
    link: z.string().optional().describe('Primary submission link'),
    otherInfo: z.string().optional().describe('Additional info / description of work'),
    tweet: z.string().optional().describe('Tweet link if required'),
    eligibilityAnswers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    ask: z.number().nullable().optional().describe('Quote amount for variable compensation'),
    telegram: z.string().optional().describe('Telegram URL for project listings'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    submissionId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const body: Record<string, unknown> = { listingId: context.listingId };
    if (context.link) body.link = context.link;
    if (context.otherInfo) body.otherInfo = context.otherInfo;
    if (context.tweet) body.tweet = context.tweet;
    if (context.eligibilityAnswers) body.eligibilityAnswers = context.eligibilityAnswers;
    if (context.ask !== undefined) body.ask = context.ask;
    if (context.telegram) body.telegram = context.telegram;

    const res = await superteamFetch<{ id?: string; message?: string }>(
      '/api/agents/submissions/create',
      { method: 'POST', body },
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Submission failed (${res.status}): ${res.data?.message || 'Unknown error'}`,
      };
    }

    return { success: true, submissionId: res.data?.id };
  },
});
