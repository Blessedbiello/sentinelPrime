import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';

export const fetchCommentsTool = createTool({
  id: 'fetch-comments',
  description: 'Fetch comments on a listing from Superteam Earn.',
  inputSchema: z.object({
    listingId: z.string().describe('Listing ID'),
    skip: z.number().default(0),
    take: z.number().default(20),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    comments: z.array(z.object({
      id: z.string(),
      message: z.string(),
      authorId: z.string().optional(),
      createdAt: z.string().optional(),
    })).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const res = await superteamFetch<unknown[]>(
      `/api/agents/comments/${context.listingId}`,
      { params: { skip: context.skip, take: context.take } },
    );

    if (!res.ok) {
      return { success: false, error: `Failed (${res.status})` };
    }

    const raw = Array.isArray(res.data) ? res.data : [];
    const comments = raw.map((c: any) => ({
      id: c.id || '',
      message: c.message || '',
      authorId: c.authorId,
      createdAt: c.createdAt,
    }));

    return { success: true, comments };
  },
});
