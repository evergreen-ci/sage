import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { parsleyOrchestrator } from './networks';
import { historyWorkflow, versionWorkflow } from './workflows/evergreen';

export const mastra: Mastra = new Mastra({
  workflows: {
    historyWorkflow,
    versionWorkflow,
  },
  agents: { evergreenAgent },
  vnext_networks: { parsleyOrchestrator },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
