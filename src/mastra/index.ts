import { Mastra } from '@mastra/core/mastra';
import { WinstonMastraLogger } from '../utils/logger/winstonMastraLogger';
import { chainOfThoughtParsleyAgent } from './agents/chainOfThoughtParsleyAgent';
import { questionClassifierAgent } from './agents/classifiers/questionClassifierAgent';
import { evergreenAgent } from './agents/evergreenAgent';
import { parsleyOrchestrator } from './networks';
import { historyWorkflow, versionWorkflow } from './workflows/evergreen';
import { planAndDelegateQuestionWorkflow } from './workflows/planning/planAndDelegateQuestion';

export const mastra: Mastra = new Mastra({
  workflows: {
    historyWorkflow,
    versionWorkflow,
    planAndDelegateQuestionWorkflow,
  },
  agents: {
    evergreenAgent,
    questionClassifierAgent,
    chainOfThoughtParsleyAgent,
  },
  vnext_networks: { parsleyOrchestrator },
  logger: new WinstonMastraLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
