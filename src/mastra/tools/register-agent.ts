import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';

export const registerAgentTool = createTool({
  id: 'register-agent',
  description: 'Register a new agent on Superteam Earn. Returns API key and claim code.',
  inputSchema: z.object({
    name: z.string().describe('Unique agent name'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    agentId: z.string().optional(),
    apiKey: z.string().optional(),
    claimCode: z.string().optional(),
    username: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const res = await superteamFetch<{
      agentId?: string;
      apiKey?: string;
      claimCode?: string;
      username?: string;
      message?: string;
    }>('/api/agents', {
      method: 'POST',
      body: { name: context.name },
      auth: false,
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Registration failed (${res.status}): ${res.data?.message || 'Unknown error'}`,
      };
    }

    return {
      success: true,
      agentId: res.data.agentId,
      apiKey: res.data.apiKey,
      claimCode: res.data.claimCode,
      username: res.data.username,
    };
  },
});
