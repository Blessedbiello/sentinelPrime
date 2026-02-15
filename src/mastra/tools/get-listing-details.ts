import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';
import { trackAction } from './heartbeat.js';

export const getListingDetailsTool = createTool({
  id: 'get-listing-details',
  description: 'Get full details of a specific listing by slug.',
  inputSchema: z.object({
    slug: z.string().describe('Listing slug'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    listing: z.record(z.unknown()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const res = await superteamFetch<Record<string, unknown>>(
      `/api/agents/listings/details/${context.slug}`,
    );

    if (!res.ok) {
      return { success: false, error: `Failed (${res.status})` };
    }

    trackAction(`fetched details for ${context.slug}`, 'analyzing requirements');
    return { success: true, listing: res.data };
  },
});
