import { BraintrustExporter } from '@mastra/braintrust';
import { Mastra } from '@mastra/core/mastra';
import { initLogger } from 'braintrust';
import { config } from '@/config';
import { WinstonMastraLogger } from '@/utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { questionClassifierAgent } from './agents/planning/questionClassifierAgent';
import { sageThinkingAgent } from './agents/planning/sageThinkingAgent';
import * as evergreenWorkflows from './workflows/evergreen';
import { logCoreAnalyzerWorkflow } from './workflows/logCoreAnalyzer';

export const braintrustLogger = initLogger({
  projectName: config.braintrust.projectName,
  apiKey: config.braintrust.apiKey,
});

export const mastra: Mastra = new Mastra({
  workflows: {
    ...evergreenWorkflows,
    logCoreAnalyzerWorkflow,
  },
  telemetry: {
    enabled: false,
  },
  observability: {
    configs: {
      braintrust: {
        serviceName: 'sage',
        exporters: [
          new BraintrustExporter({
            apiKey: config.braintrust.apiKey,
            projectName: config.braintrust.projectName,
          }),
        ],
      },
    },
  },
  agents: { sageThinkingAgent, evergreenAgent, questionClassifierAgent },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
