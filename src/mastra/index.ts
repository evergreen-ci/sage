import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';
import { taskWorkflow } from './workflows/taskWorkflow';
import { taskWithHistoryWorkflow } from './workflows/taskWithHistoryWorkflow';

export const mastra: Mastra = new Mastra({
  workflows: { taskWorkflow, taskWithHistoryWorkflow },
  agents: { parsleyAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
