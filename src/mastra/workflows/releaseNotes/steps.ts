import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  buildReleaseNotesSectionPlans,
  releaseNotesAgent,
  releaseNotesOutputSchema,
  validateReleaseNotesCitations,
  type SectionPlannerContext,
} from '@/mastra/agents/releaseNotesAgent';
import {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  WorkflowStateSchema,
} from './schemas';

/**
 * Maximum number of attempts for agent generation retries.
 * This is distinct from workflow-level retries (configured in retryConfig).
 * Workflow retries retry the entire step if it throws an error.
 * Agent generation retries retry the agent call if JSON validation fails.
 */
const MAX_AGENT_GENERATION_ATTEMPTS = 3;

/**
 * System prompt used for retry attempts when the agent fails to return valid JSON.
 *
 * This prompt is intentionally more strict and prescriptive than the agent's base
 * instructions. While there is some duplication with the base instructions, this
 * duplication is necessary because:
 * 1. Retry attempts need stricter enforcement after a validation failure
 * 2. The prompt emphasizes critical schema requirements more forcefully
 * 3. It provides explicit guidance on common failure patterns (e.g., using "title"
 *    instead of "text" for items, including empty citations arrays)
 *
 * The base agent instructions provide general guidance, while this retry prompt
 * focuses specifically on ensuring schema compliance when the agent has already
 * failed validation once.
 */
const RETRY_SYSTEM_PROMPT = [
  'CRITICAL: Return ONLY valid JSON matching this exact schema.',
  'Do not include any fields outside of "sections".',
  'Each section must have "title" and "items".',
  'Each item MUST use "text" (NOT "title") for the item content.',
  'Only sections use "title" - items always use "text".',
  'Each item must have "text" and optionally "citations" (non-empty array if present), "subitems", and "links".',
  'NEVER include "citations": [] - if there are no citations, omit the citations field entirely.',
  'Remove any top-level fields other than "sections".',
].join('\n');

/**
 * Formats section plans into a prompt string for the agent
 * This mirrors the logic from formatSectionPlansForPrompt in the agent file
 * @param context - The section planner context containing sections and issues
 * @returns Formatted prompt string
 */
const formatSectionPlansForPrompt = (
  context: SectionPlannerContext
): string => {
  const lines: string[] = ['## Section Titles'];

  for (const section of context.sections) {
    if (section.focus) {
      lines.push(`- ${section.title}: ${section.focus}`);
    } else {
      lines.push(`- ${section.title}`);
    }
  }

  lines.push('\n## Issue Summaries');

  for (const issue of context.issues) {
    lines.push(`### ${issue.key} (${issue.issueType})`);
    lines.push(`Summary: ${issue.summary}`);
    if (issue.curatedCopy) {
      lines.push(`Curated Copy: ${issue.curatedCopy}`);
    }
    if (issue.description) {
      lines.push(`Description: ${issue.description}`);
    }
    if (issue.metadata && Object.keys(issue.metadata).length > 0) {
      lines.push('Metadata:');
      for (const [key, value] of Object.entries(issue.metadata)) {
        lines.push(`- ${key}: ${value}`);
      }
    }
    if (issue.pullRequests?.length > 0) {
      lines.push('Pull Requests:');
      for (const pr of issue.pullRequests) {
        const prLine =
          pr.description && pr.description.length > 0
            ? `${pr.title} :: ${pr.description}`
            : pr.title;
        lines.push(`- ${prLine}`);
      }
    }
  }

  if (context.hasSecurityIssues) {
    lines.push(
      '\nSecurity-related issues are present. Consider grouping CVE fixes under a parent bullet such as "Fixes the following CVEs:" with one sub-bullet per vulnerability.'
    );
  }

  return lines.join('\n');
};

/**
 * Step 1: Build section plans from input data
 * Analyzes Jira issues and creates a structured plan for organizing release notes
 */
export const planSectionsStep = createStep({
  id: 'plan-sections',
  description: 'Build section plans from Jira issues and input metadata',
  inputSchema: WorkflowInputSchema,
  stateSchema: WorkflowStateSchema,
  outputSchema: z.object({}),
  execute: async ({
    inputData,
    mastra: mastraInstance,
    setState,
    state,
    tracingContext,
  }) => {
    const logger = mastraInstance.getLogger();

    logger.debug('Building section plans', {
      issueCount: inputData.jiraIssues?.length ?? 0,
      sectionCount: inputData.sections?.length ?? 0,
    });

    const sectionPlans = buildReleaseNotesSectionPlans(inputData);

    tracingContext.currentSpan?.update({
      metadata: {
        issueCount: sectionPlans.issues.length,
        sectionCount: sectionPlans.sections.length,
        hasSecurityIssues: sectionPlans.hasSecurityIssues,
      },
    });

    setState({
      ...state,
      input: inputData,
      sectionPlans,
    });

    return {};
  },
});

/**
 * Step 2: Format the prompt for the agent
 * Converts section plans and input data into a formatted prompt
 */
export const formatPromptStep = createStep({
  id: 'format-prompt',
  description: 'Format section plans into a prompt for the release notes agent',
  inputSchema: z.object({}),
  stateSchema: WorkflowStateSchema,
  outputSchema: z.object({}),
  execute: async ({
    mastra: mastraInstance,
    setState,
    state,
    tracingContext,
  }) => {
    const logger = mastraInstance.getLogger();

    if (!state.input || !state.sectionPlans) {
      throw new Error('Input or section plans not found in state');
    }

    logger.debug('Formatting prompt for agent');

    // Format the section plans
    const sectionPlanner = formatSectionPlansForPrompt(state.sectionPlans);

    // Build the full prompt with metadata and requirements
    const metadataLines = ['# Release Notes Source Data'];

    if (
      state.input.customGuidelines &&
      state.input.customGuidelines.trim().length > 0
    ) {
      metadataLines.push('Custom guidelines:');
      metadataLines.push(state.input.customGuidelines.trim());
    }

    const requirements: string[] = [
      'Return valid JSON that exactly matches the schema provided in your system prompt.',
      'CRITICAL: Use "text" (NOT "title") for all items and subitems. Only sections use "title" - items always use "text".',
      'Use the section titles surfaced in the Section Planner. Add new sections only when the data strongly suggests a distinct category.',
      'Assign each issue to the section that best matches its change; if no section is a perfect fit, choose the closest match and make the rationale clear in the bullet text.',
      'Summarize each bullet in one or two sentences that highlight user-facing impact.',
      'Prefer curated copy fields (release_notes, customer_impact, upgrade_notes) when present; otherwise synthesize text from summaries, descriptions, and metadata.',
      'Do not invent details beyond what appears in the planner.',
      'Use subitems for supporting context such as grouped vulnerabilities, follow-on tasks, or pull request details.',
      'Wrap tokens that a user might copy verbatim (versions, package names, CLI commands, file paths, environment variables) in single backticks; avoid multiline code fences.',
      'When hyperlink guidance is available (for example in metadata or guidelines), populate the links array with { "text", "url" } objects instead of embedding inline markup.',
      'Keep bullet text plain prose (no markdown, Jira formatting, or decorative prefixes).',
      'Include a citations array only when at least one Jira issue applies to that bullet; omit the field for structural or grouping bullets, but ensure actionable top-level bullets cite their supporting Jira keys. NEVER include an empty citations array ([]). If there are no citations, omit the citations field entirely.',
      'Omit the citations property on subitems only when they inherit the citation from their parent bullet.',
      'Do not create subitems that only point to additional reading (for example, "See the release notes"). Capture URLs via the links array on the relevant bullet instead.',
    ];

    requirements.push(
      'If a section plan instructs you to group vulnerabilities, use a parent bullet with subitems for the individual CVEs.'
    );
    requirements.push(
      'For pull requests listed under an issue, prefer subitems that briefly describe the change and cite the parent issue.'
    );

    const formattedPrompt = [
      metadataLines.join('\n'),
      '# Section Planner',
      sectionPlanner,
      '# Output Requirements',
      requirements.map(line => `- ${line}`).join('\n'),
    ].join('\n\n');

    tracingContext.currentSpan?.update({
      metadata: {
        promptLength: formattedPrompt.length,
      },
    });

    setState({
      ...state,
      formattedPrompt,
    });

    return {};
  },
});

/**
 * Step 3: Generate release notes using the agent
 * Calls the release notes agent with retry logic
 */
export const generateStep = createStep({
  id: 'generate-release-notes',
  description: 'Generate release notes using the agent with retry logic',
  inputSchema: z.object({}),
  stateSchema: WorkflowStateSchema,
  outputSchema: z.object({
    rawOutput: z.unknown(),
  }),
  execute: async ({
    abortSignal,
    mastra: mastraInstance,
    state,
    tracingContext,
  }) => {
    const logger = mastraInstance.getLogger();

    if (!state.formattedPrompt) {
      throw new Error('Formatted prompt not found in state');
    }

    let lastError: Error | undefined;

    for (
      let attemptIndex = 0;
      attemptIndex < MAX_AGENT_GENERATION_ATTEMPTS;
      attemptIndex++
    ) {
      try {
        logger.debug('Calling release notes agent', {
          attempt: attemptIndex + 1,
          maxAttempts: MAX_AGENT_GENERATION_ATTEMPTS,
        });

        // On retry attempts, prepend stricter instructions to the prompt
        // Note: Mastra's agent.generate() doesn't support a 'system' parameter,
        // so we prepend the retry instructions to the user message instead
        const promptForAttempt =
          attemptIndex === 0
            ? state.formattedPrompt
            : `${RETRY_SYSTEM_PROMPT}\n\n---\n\n${state.formattedPrompt}`;

        // eslint-disable-next-line no-await-in-loop -- Retries must be sequential
        const result = await releaseNotesAgent.generate(promptForAttempt, {
          structuredOutput: {
            schema: releaseNotesOutputSchema,
          },
          abortSignal,
        });

        tracingContext.currentSpan?.update({
          metadata: {
            attempt: attemptIndex + 1,
            hasStructuredOutput: !!result.object,
            hasTextOutput: !!result.text,
          },
        });

        return {
          rawOutput: result.object || result.text || null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (
          attemptIndex === MAX_AGENT_GENERATION_ATTEMPTS - 1 ||
          !lastError.message.includes('does not match the expected schema')
        ) {
          throw lastError;
        }

        logger.warn('Release notes generation failed, retrying', {
          attempt: attemptIndex + 1,
          maxAttempts: MAX_AGENT_GENERATION_ATTEMPTS,
          error: lastError.message,
        });
      }
    }

    throw (
      lastError || new Error('Failed to generate release notes after retries')
    );
  },
});

/**
 * Step 4: Validate and normalize the output
 * Ensures the output matches the schema and validates citations
 */
export const validateStep = createStep({
  id: 'validate-output',
  description: 'Validate and normalize the release notes output',
  inputSchema: z.object({
    rawOutput: z.unknown(),
  }),
  stateSchema: WorkflowStateSchema,
  outputSchema: WorkflowOutputSchema,
  execute: async ({ inputData, mastra: mastraInstance, tracingContext }) => {
    const logger = mastraInstance.getLogger();

    const { rawOutput } = inputData;

    if (!rawOutput) {
      throw new Error('Raw output not found');
    }

    logger.debug('Validating release notes output');

    // Parse and validate the output using the schema
    // The agent already returns structured output, so this should be valid
    const parseResult = releaseNotesOutputSchema.safeParse(rawOutput);

    if (!parseResult.success) {
      logger.error('Release notes output validation failed', {
        errors: parseResult.error.issues,
        rawOutput: JSON.stringify(rawOutput).substring(0, 500),
      });
      throw new Error(
        `Release notes output validation failed: ${parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      );
    }

    const validated = parseResult.data;

    // Validate citations
    validateReleaseNotesCitations(validated);

    tracingContext.currentSpan?.update({
      metadata: {
        sectionCount: validated.sections.length,
        totalItems: validated.sections.reduce(
          (sum, section) => sum + section.items.length,
          0
        ),
      },
      output: {
        sections: validated.sections.map(s => s.title),
      },
    });

    return validated;
  },
});
