import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { evergreenAgent } from './agents/evergreenAgent';
import { questionClassifierAgent } from './agents/planning/questionClassifierAgent';
import { sageThinkingAgent } from './agents/planning/sageThinkingAgent';
import { parsleyOrchestrator } from './networks';
import { historyWorkflow, versionWorkflow } from './workflows/evergreen';
import { logCoreAnalyzerWorkflow } from './workflows/logCoreAnalyzerWorkflow';

export const mastra: Mastra = new Mastra({
  workflows: {
    historyWorkflow,
    logCoreAnalyzerWorkflow,
    versionWorkflow,
  },
  agents: { sageThinkingAgent, evergreenAgent, questionClassifierAgent },
  vnext_networks: { parsleyOrchestrator },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
