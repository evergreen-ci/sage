import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';
import { parsleyNetwork } from './networks';
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
  agents: { parsleyAgent },
  networks: { parsleyNetwork },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
