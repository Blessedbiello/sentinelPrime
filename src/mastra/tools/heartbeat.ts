import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const AGENT_NAME = 'SentinelPrime';
const VERSION = 'earn-agent-mvp';
const CAPABILITIES = ['register', 'listings', 'submit', 'claim'] as const;

let lastAction = 'initialized';
let nextAction = 'awaiting discovery';
let lastApiCallTime = Date.now();

export function trackAction(action: string, next: string) {
  lastAction = action;
  nextAction = next;
  lastApiCallTime = Date.now();
}

export function getLastApiCallTime() {
  return lastApiCallTime;
}

function resolveStatus(): 'ok' | 'degraded' | 'blocked' {
  const apiKey = process.env.SUPERTEAM_API_KEY;
  if (!apiKey) return 'blocked';

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return 'degraded';

  return 'ok';
}

export const heartbeatTool = createTool({
  id: 'heartbeat',
  description:
    'Returns agent liveness and state per Superteam Earn heartbeat spec. ' +
    'Call when supervisor pings, scheduler requests status, or no API activity for 10+ minutes.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    status: z.enum(['ok', 'degraded', 'blocked']),
    agentName: z.string(),
    time: z.string(),
    version: z.string(),
    capabilities: z.array(z.string()),
    lastAction: z.string(),
    nextAction: z.string(),
  }),
  execute: async () => {
    const status = resolveStatus();

    return {
      status,
      agentName: AGENT_NAME,
      time: new Date().toISOString(),
      version: VERSION,
      capabilities: [...CAPABILITIES],
      lastAction: status === 'blocked'
        ? `${lastAction} — blocked: missing SUPERTEAM_API_KEY`
        : lastAction,
      nextAction,
    };
  },
});
