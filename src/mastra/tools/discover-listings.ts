import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';

export const discoverListingsTool = createTool({
  id: 'discover-listings',
  description: 'Fetch live agent-eligible bounty listings from Superteam Earn.',
  inputSchema: z.object({
    take: z.number().default(20).describe('Number of listings to fetch'),
    deadline: z.string().optional().describe('Filter by deadline date (ISO string)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    listings: z.array(z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      type: z.string().optional(),
      token: z.string().optional(),
      rewardAmount: z.number().optional(),
      compensationType: z.string().optional(),
      deadline: z.string().optional(),
      agentAccess: z.string().optional(),
    })).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const params: Record<string, string | number> = { take: context.take };
    if (context.deadline) params.deadline = context.deadline;

    const res = await superteamFetch<unknown[]>('/api/agents/listings/live', { params });

    if (!res.ok) {
      return { success: false, error: `Failed (${res.status})` };
    }

    const raw = Array.isArray(res.data) ? res.data : [];
    const listings = raw.map((item: any) => ({
      id: item.id || '',
      slug: item.slug || '',
      title: item.title || '',
      type: item.type,
      token: item.token,
      rewardAmount: item.rewardAmount,
      compensationType: item.compensationType,
      deadline: item.deadline,
      agentAccess: item.agentAccess,
    }));

    return { success: true, listings };
  },
});
