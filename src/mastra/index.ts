import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';
import {
  historyWorkflow,
  versionWorkflow,
  taskTestWorkflow,
} from './workflows';

export const mastra: Mastra = new Mastra({
  workflows: {
    historyWorkflow,
    versionWorkflow,
    taskTestWorkflow,
  },
  agents: { parsleyAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
