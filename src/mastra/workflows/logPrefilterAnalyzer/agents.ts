import { Agent } from '@mastra/core/agent';
import { prefilterAnalyzerConfig } from './config';
import {
  PREFILTER_INITIAL_ANALYZER_INSTRUCTIONS,
  PREFILTER_REFINEMENT_INSTRUCTIONS,
  PREFILTER_REPORT_FORMATTER_INSTRUCTIONS,
} from './prompts';

export const prefilterInitialAnalyzerAgent = new Agent({
  id: 'prefilterInitialAnalyzerAgent',
  name: 'prefilterInitialAnalyzerAgent',
  description:
    'Performs initial analysis of pre-filtered error excerpts from log files',
  instructions: PREFILTER_INITIAL_ANALYZER_INSTRUCTIONS,
  model: prefilterAnalyzerConfig.models.initial,
});

export const prefilterRefinementAgent = new Agent({
  id: 'prefilterRefinementAgent',
  name: 'prefilterRefinementAgent',
  description:
    'Iteratively refines error analysis summaries with new pre-filtered chunks',
  instructions: PREFILTER_REFINEMENT_INSTRUCTIONS,
  model: prefilterAnalyzerConfig.models.refinement,
});

export const prefilterReportFormatterAgent = new Agent({
  id: 'prefilterReportFormatterAgent',
  name: 'prefilterReportFormatterAgent',
  description: 'Formats pre-filtered error analysis into structured reports',
  instructions: PREFILTER_REPORT_FORMATTER_INSTRUCTIONS,
  model: prefilterAnalyzerConfig.models.formatter,
});
