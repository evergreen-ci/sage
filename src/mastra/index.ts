import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { parsleyOrchestrator } from './networks';
import { logCoreAnalyzerWorkflow } from './workflows';
import {
  getTaskHistoryWorkflow,
  getVersionWorkflow,
} from './workflows/evergreen';

export const mastra: Mastra = new Mastra({
  workflows: {
    getTaskHistoryWorkflow,
    logCoreAnalyzerWorkflow,
    getVersionWorkflow,
  },
  agents: { evergreenAgent },
  vnext_networks: { parsleyOrchestrator },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
