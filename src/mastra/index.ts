import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { parsleyAgent } from './agents/parsleyAgent';

export const mastra: Mastra = new Mastra({
  workflows: {},
  agents: { parsleyAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    serviceName: "sage",
    enabled: true,
    sampling: {
      type: "always_on",
    },
    export: {
      type: "otlp",
    },
  },
});
