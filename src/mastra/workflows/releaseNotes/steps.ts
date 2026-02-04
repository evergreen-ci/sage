import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  buildReleaseNotesSectionPlans,
  releaseNotesAgent,
  releaseNotesOutputSchema,
  validateReleaseNotesCitations,
  type SectionPlannerContext,
} from '@/mastra/agents/releaseNotesAgent';
import { WorkflowInputSchema, WorkflowStateSchema } from './schemas';

/**
 * Formats section plans into a prompt string for the agent.
 * This function formats the section planner context into a structured prompt
 * that the release notes agent can use for generation.
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
    if (issue.pullRequests?.length) {
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
        plannedSections: sectionPlans.sections.map(s => s.title),
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
  execute: async ({ mastra: mastraInstance, setState, state }) => {
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

    const requirements = `- Return valid JSON that exactly matches the schema provided in your system prompt.
- CRITICAL: Use "text" (NOT "title") for all items and subitems. Only sections use "title" - items always use "text".
- Use the section titles surfaced in the Section Planner. Add new sections only when the data strongly suggests a distinct category.
- Assign each issue to the section that best matches its change; if no section is a perfect fit, choose the closest match and make the rationale clear in the bullet text.
- Summarize each bullet in one or two sentences that highlight user-facing impact.
- Prefer curated copy fields (release_notes, customer_impact, upgrade_notes) when present; otherwise synthesize text from summaries, descriptions, and metadata.
- Do not invent details beyond what appears in the planner.
- Use subitems for supporting context such as grouped vulnerabilities, follow-on tasks, or pull request details.
- Wrap tokens that a user might copy verbatim (versions, package names, CLI commands, file paths, environment variables) in single backticks; avoid multiline code fences.
- When hyperlink guidance is available (for example in metadata or guidelines), populate the links array with { "text", "url" } objects instead of embedding inline markup.
- Keep bullet text plain prose (no markdown, Jira formatting, or decorative prefixes).
- Include a citations array only when at least one Jira issue applies to that bullet; omit the field for structural or grouping bullets, but ensure actionable top-level bullets cite their supporting Jira keys. NEVER include an empty citations array ([]). If there are no citations, omit the citations field entirely.
- Omit the citations property on subitems only when they inherit the citation from their parent bullet.
- Do not create subitems that only point to additional reading (for example, "See the release notes"). Capture URLs via the links array on the relevant bullet instead.
- If a section plan instructs you to group vulnerabilities, use a parent bullet with subitems for the individual CVEs.
- For pull requests listed under an issue, prefer subitems that briefly describe the change and cite the parent issue.`;

    const formattedPrompt = `${metadataLines.join('\n')}

# Section Planner
${sectionPlanner}

# Output Requirements
${requirements}`;

    setState({
      ...state,
      formattedPrompt,
    });

    return {};
  },
});

/**
 * Step 3: Generate release notes using the agent
 * Uses Mastra's built-in retry configuration for error handling
 */
export const generateStep = createStep({
  id: 'generate-release-notes',
  description: 'Generate release notes using the agent',
  inputSchema: z.object({}),
  stateSchema: WorkflowStateSchema,
  outputSchema: z.object({
    structuredOutput: releaseNotesOutputSchema,
  }),
  retries: 2,
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

    logger.debug('Calling release notes agent');

    const result = await releaseNotesAgent.generate(state.formattedPrompt, {
      structuredOutput: {
        schema: releaseNotesOutputSchema,
      },
      abortSignal,
    });

    tracingContext.currentSpan?.update({
      metadata: {
        hasStructuredOutput: !!result.object,
        hasTextOutput: !!result.text,
      },
    });

    if (!result.object) {
      throw new Error('Agent did not return structured output');
    }

    return {
      structuredOutput: result.object,
    };
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
    structuredOutput: releaseNotesOutputSchema,
  }),
  stateSchema: WorkflowStateSchema,
  outputSchema: releaseNotesOutputSchema,
  execute: async ({ inputData, mastra: mastraInstance, tracingContext }) => {
    const logger = mastraInstance.getLogger();

    const { structuredOutput } = inputData;

    logger.debug('Validating release notes output');

    // The agent already returns structured output matching the schema
    const parseResult = releaseNotesOutputSchema.safeParse(structuredOutput);

    if (!parseResult.success) {
      logger.error('Release notes output validation failed', {
        errors: parseResult.error.issues,
        structuredOutput: JSON.stringify(structuredOutput).substring(0, 500),
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
