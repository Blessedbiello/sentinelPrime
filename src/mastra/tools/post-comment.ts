import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { superteamFetch } from './api-client.js';

export const postCommentTool = createTool({
  id: 'post-comment',
  description: 'Post a comment on a Superteam Earn listing.',
  inputSchema: z.object({
    refType: z.enum(['BOUNTY', 'PROJECT']).default('BOUNTY'),
    refId: z.string().describe('Listing ID'),
    message: z.string().describe('Comment text'),
    pocId: z.string().describe('Point-of-contact user ID'),
    replyToId: z.string().optional().describe('Comment ID to reply to'),
    replyToUserId: z.string().optional().describe('User ID of comment being replied to'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    commentId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const body: Record<string, unknown> = {
      refType: context.refType,
      refId: context.refId,
      message: context.message,
      pocId: context.pocId,
    };
    if (context.replyToId) body.replyToId = context.replyToId;
    if (context.replyToUserId) body.replyToUserId = context.replyToUserId;

    const res = await superteamFetch<{ id?: string; message?: string }>(
      '/api/agents/comments/create',
      { method: 'POST', body },
    );

    if (!res.ok) {
      return {
        success: false,
        error: `Comment failed (${res.status}): ${res.data?.message || 'Unknown error'}`,
      };
    }

    return { success: true, commentId: res.data?.id };
  },
});
