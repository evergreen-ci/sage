import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';
import {
  historyWorkflow,
  taskWorkflow,
  versionWorkflow,
  taskFilesWorkflow,
  taskTestWorkflow,
  logCoreAnalyzer,
} from './workflows';

export const mastra: Mastra = new Mastra({
  workflows: {
    taskWorkflow,
    historyWorkflow,
    versionWorkflow,
    taskTestWorkflow,
    taskFilesWorkflow,
    logCoreAnalyzer,
  },
  agents: { parsleyAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
