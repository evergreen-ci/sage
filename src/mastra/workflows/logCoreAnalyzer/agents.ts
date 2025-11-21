import { Agent } from '@mastra/core/agent';
import { logAnalyzerConfig } from './config';
import {
  INITIAL_ANALYZER_INSTRUCTIONS,
  REFINEMENT_AGENT_INSTRUCTIONS,
  REPORT_FORMATTER_INSTRUCTIONS,
} from './prompts';

/**
 * The initialAnalyzerAgent performs the first-pass analysis of technical documents.
 * Uses a larger model config for improved context and structure understanding.
 */
export const initialAnalyzerAgent = new Agent({
  id: 'initial-analyzer-agent',
  name: 'initial-analyzer-agent',
  description:
    'Performs initial analysis of technical documents to understand structure and key patterns',
  instructions: INITIAL_ANALYZER_INSTRUCTIONS,
  model: logAnalyzerConfig.models.initial,
});

/**
 * The refinementAgent iteratively processes additional document chunks.
 * Utilizes a cost-effective model for refining and updating technical summaries.
 * Used especially for large files to incrementally enhance the summary.
 */
export const refinementAgent = new Agent({
  id: 'refinement-agent',
  name: 'refinement-agent',
  description:
    'Iteratively refines and updates technical summaries with new chunks',
  instructions: REFINEMENT_AGENT_INSTRUCTIONS,
  model: logAnalyzerConfig.models.refinement,
});

/**
 * The reportFormatterAgent formats technical summaries into user-facing output.
 * Responsible for structuring the final result in various output formats.
 */
export const reportFormatterAgent = new Agent({
  id: 'report-formatter-agent',
  name: 'report-formatter-agent',
  description: 'Formats technical summaries into various output formats',
  instructions: REPORT_FORMATTER_INSTRUCTIONS,
  model: logAnalyzerConfig.models.formatter,
});
