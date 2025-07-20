import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { parsleyAgent } from './agents/parsley-agent';

export const mastra = new Mastra({
  workflows: {},
  agents: { parsleyAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
