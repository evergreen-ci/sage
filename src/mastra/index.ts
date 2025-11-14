import { BraintrustExporter } from '@mastra/braintrust';
import type { AnyExportedAISpan } from '@mastra/core/ai-tracing';
import { Mastra } from '@mastra/core/mastra';
import { initLogger } from 'braintrust';
import { config } from '@/config';
import { WinstonMastraLogger } from '@/utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { questionClassifierAgent } from './agents/planning/questionClassifierAgent';
import { sageThinkingAgent } from './agents/planning/sageThinkingAgent';
import { questionOwnershipAgent } from './agents/questionOwnershipAgent';
import * as evergreenWorkflows from './workflows/evergreen';
import { logCoreAnalyzerWorkflow } from './workflows/logCoreAnalyzer';

export const braintrustLogger = initLogger({
  projectName: config.braintrust.projectName,
  apiKey: config.braintrust.apiKey,
});

// Monkeypatch BraintrustExporter to use our pre-initialized braintrustLogger
// This prevents the exporter from creating its own internal logger instances
(
  BraintrustExporter.prototype as unknown as {
    initLogger: (span: AnyExportedAISpan) => Promise<void>;
  }
).initLogger = async function (span: AnyExportedAISpan) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accessing private traceMap field
  (this as any).traceMap.set(span.traceId, {
    logger: braintrustLogger,
    spans: new Map(),
    activeIds: new Set(),
  });
};

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
        exporters:
          process.env.BRAINTRUST_EVAL === 'true'
            ? []
            : [
                new BraintrustExporter({
                  apiKey: config.braintrust.apiKey,
                  projectName: config.braintrust.projectName,
                }),
              ],
      },
    },
  },
  agents: {
    sageThinkingAgent,
    evergreenAgent,
    questionClassifierAgent,
    questionOwnershipAgent,
  },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
