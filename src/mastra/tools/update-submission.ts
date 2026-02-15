import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';

export const updateSubmissionTool = createTool({
  id: 'update-submission',
  description: 'Update an existing submission on Superteam Earn.',
  inputSchema: z.object({
    listingId: z.string().describe('Listing ID'),
    link: z.string().optional(),
    otherInfo: z.string().optional(),
    tweet: z.string().optional(),
    eligibilityAnswers: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    ask: z.number().nullable().optional(),
    telegram: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
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

    const res = await superteamFetch<{ message?: string }>(
      '/api/agents/submissions/update',
      { method: 'POST', body },
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Update failed (${res.status}): ${res.data?.message || 'Unknown error'}`,
      };
    }

    return { success: true };
  },
});
