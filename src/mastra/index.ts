import { Mastra } from '@mastra/core/mastra';
import { scoutAgent } from './agents/scout.js';
import { sentinelPrimeAgent } from './agents/sentinel-prime.js';
import { discoveryWorkflow } from './workflows/discovery.js';
import { executionWorkflow } from './workflows/execution.js';

export const mastra = new Mastra({
  agents: {
    scout: scoutAgent,
    sentinelPrime: sentinelPrimeAgent,
  },
  workflows: {
    discoveryWorkflow,
    executionWorkflow,
  },
});
