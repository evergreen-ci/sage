import { BraintrustExporter } from '@mastra/braintrust';
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { initLogger } from 'braintrust';
import { config } from '@/config';
import { WinstonMastraLogger } from '@/utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { questionClassifierAgent } from './agents/planning/questionClassifierAgent';
import { sageThinkingAgent } from './agents/planning/sageThinkingAgent';
import { questionOwnershipAgent } from './agents/questionOwnershipAgent';
import { releaseNotesAgent } from './agents/releaseNotesAgent';
import { slackThreadSummarizerAgent } from './agents/slackThreadSummarizerAgent';
import { memoryStore } from './utils/memory';
import * as evergreenWorkflows from './workflows/evergreen';
import { logCoreAnalyzerWorkflow } from './workflows/logCoreAnalyzer';
import { releaseNotesWorkflow } from './workflows/releaseNotes';

export const braintrustLogger = initLogger({
  projectName: config.braintrust.projectName,
  apiKey: config.braintrust.apiKey,
});

export const mastra: Mastra = new Mastra({
  workflows: {
    ...evergreenWorkflows,
    logCoreAnalyzerWorkflow,
    releaseNotesWorkflow,
  },
  observability: new Observability({
    configs: {
      braintrust: {
        serviceName: 'sage',
        exporters: [
          new BraintrustExporter({
            apiKey: config.braintrust.apiKey,
            projectName: config.braintrust.projectName,
            braintrustLogger: braintrustLogger,
          }),
        ],
      },
    },
  }),
  storage: memoryStore,
  agents: {
    sageThinkingAgent,
    evergreenAgent,
    questionClassifierAgent,
    questionOwnershipAgent,
    slackThreadSummarizerAgent,
    releaseNotesAgent,
  },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
