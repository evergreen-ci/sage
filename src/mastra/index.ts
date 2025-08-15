import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';
import { thinkingLogAnalyzerAgent } from './agents/thinking/thinkingLogAnalyzerAgent';

export const mastra: Mastra = new Mastra({
  workflows: {},
  agents: { parsleyAgent, thinkingLogAnalyzerAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
