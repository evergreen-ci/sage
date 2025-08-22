import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { parsleyOrchestrator } from './networks';
import {
  historyWorkflow,
  taskWorkflow,
  versionWorkflow,
  taskFilesWorkflow,
  taskTestWorkflow,
} from './workflows';

export const mastra: Mastra = new Mastra({
  workflows: {
    taskWorkflow,
    historyWorkflow,
    versionWorkflow,
    taskTestWorkflow,
    taskFilesWorkflow,
  },
  agents: { evergreenAgent },
  vnext_networks: { parsleyOrchestrator },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
