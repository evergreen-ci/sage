import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';
import { taskWorkflow } from './workflows/taskWorkflow';
import { historyWorkflow } from './workflows/historyWorkflow';
import { versionWorkflow } from './workflows/versionWorkflow';

export const mastra: Mastra = new Mastra({
  workflows: { taskWorkflow, historyWorkflow, versionWorkflow },
  agents: { parsleyAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
