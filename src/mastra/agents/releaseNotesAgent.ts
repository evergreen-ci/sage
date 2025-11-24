import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import { createToolFromAgent } from '@/mastra/tools/utils';
import { RELEASE_NOTES_AGENT_NAME } from './constants';

const normalizeIssueType = (value: string): string =>
  value.trim().toUpperCase();

type ReleaseNotesIssueType = string;

const issueTypeValueSchema = z
  .string()
  .min(1, 'Issue type must not be empty.')
  .transform(normalizeIssueType);

const DEFAULT_SECTION_TITLES = ['Improvements', 'Bug Fixes'] as const;

const releaseNotesSectionTitleSchema = z
  .string()
  .min(1, 'Section title must not be empty.')
  .transform(value => value.trim());

/** Input schema for pull request metadata */
const pullRequestSchema = z.object({
  title: z.string().describe('Pull request title'),
  description: z
    .string()
    .describe('Pull request description in markdown format'),
});

/** Input schema for Jira issue metadata */
const jiraIssueSchema = z.object({
  key: z.string().describe('Jira issue key (e.g., "PROJ-123")'),
  issueType: issueTypeValueSchema.describe('Type of Jira issue'),
  summary: z.string().describe('Jira issue summary/title'),
  description: z.string().optional().describe('Jira issue description'),
  additionalMetadata: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Optional key/value metadata pairs (for example release_notes, customer_impact, or upgrade_notes)'
    ),
  pullRequests: z
    .array(pullRequestSchema)
    .optional()
    .describe('Pull requests associated with the Jira issue'),
});

/** Input schema for release notes generation */
const releaseNotesInputSchema = z.object({
  jiraIssues: z
    .array(jiraIssueSchema)
    .describe('Array of Jira issues associated with the release'),
  sections: z
    .array(releaseNotesSectionTitleSchema)
    .min(1, 'Provide at least one section title.')
    .default([...DEFAULT_SECTION_TITLES])
    .describe(
      'Ordered list of section titles. Defaults to Improvements and Bug Fixes.'
    ),
  customGuidelines: z
    .string()
    .optional()
    .describe(
      'Optional custom guidelines specific to the product/project (e.g., section ordering, special formatting rules)'
    ),
});

type ReleaseNotesLink = {
  text: string;
  url: string;
};

type ReleaseNotesItem = {
  text: string;
  citations?: string[];
  subitems?: ReleaseNotesItem[];
  links?: ReleaseNotesLink[];
};

type ReleaseNotesSection = {
  title: string;
  items: ReleaseNotesItem[];
};

type ReleaseNotesOutput = {
  sections: ReleaseNotesSection[];
};

const releaseNotesLinkSchema: z.ZodType<ReleaseNotesLink> = z.object({
  text: z
    .string()
    .min(1, 'Link text must not be empty.')
    .describe('Exact substring within the bullet text to hyperlink'),
  url: z
    .string()
    .url('Link URLs must be valid.')
    .describe('Destination URL for the hyperlink'),
});

/** Output schema for structured release notes */
const releaseNotesItemSchema: z.ZodType<ReleaseNotesItem> = z.lazy(() =>
  z.object({
    text: z
      .string()
      .min(1, 'Each bullet must include descriptive text.')
      .describe('Bullet text for this item'),
    citations: z
      .array(z.string())
      .nonempty('Provide at least one citation when the field is present.')
      .optional()
      .describe('Supporting Jira issue keys for this item'),
    subitems: z
      .array(releaseNotesItemSchema)
      .optional()
      .describe('Nested bullet points under this item'),
    links: z
      .array(releaseNotesLinkSchema)
      .optional()
      .describe(
        'Specific substrings within the bullet text that should be hyperlinked'
      ),
  })
);

const releaseNotesSectionSchema: z.ZodType<ReleaseNotesSection> = z.object({
  title: z
    .string()
    .min(1, 'Each section needs a title.')
    .describe('Section heading (e.g., "Improvements")'),
  items: z
    .array(releaseNotesItemSchema)
    .min(1, 'Each section should contain at least one bullet item.')
    .describe('Bullet items that belong to this section'),
});

const releaseNotesOutputSchema: z.ZodType<ReleaseNotesOutput> = z.object({
  sections: z
    .array(releaseNotesSectionSchema)
    .min(1, 'Provide at least one section in the response.')
    .describe('Structured release notes grouped into sections with items'),
});

type SectionPlanIssue = {
  key: string;
  issueType: ReleaseNotesIssueType;
  summary: string;
  description?: string;
  curatedCopy?: string;
  metadata?: Record<string, string>;
  pullRequests: Array<{ title: string; description?: string }>;
};

type SectionPlan = {
  title: string;
  focus?: string;
};

type SectionPlannerContext = {
  sections: SectionPlan[];
  issues: SectionPlanIssue[];
  hasSecurityIssues: boolean;
};

const CURATED_COPY_KEYS = ['release_notes', 'customer_impact', 'upgrade_notes'];

const buildReleaseNotesSectionPlans = (
  input: z.infer<typeof releaseNotesInputSchema>
): SectionPlannerContext => {
  const sections = input.sections.map(title => ({
    title,
    focus: deriveDefaultFocus(title),
  }));

  const issues = input.jiraIssues.map(createSectionPlanIssue);

  return {
    sections,
    issues,
    hasSecurityIssues: input.jiraIssues.some(issue => isSecurityIssue(issue)),
  };
};

const createSectionPlanIssue = (
  issue: z.infer<typeof releaseNotesInputSchema>['jiraIssues'][number]
): SectionPlanIssue => {
  const { additionalMetadata } = issue;
  const { copy: curatedCopy, key: curatedKey } =
    coalesceCuratedCopy(additionalMetadata);
  const metadata = extractNonCuratedMetadata(additionalMetadata, curatedKey);

  return {
    key: issue.key,
    issueType: issue.issueType,
    summary: issue.summary,
    description: issue.description?.trim() || undefined,
    curatedCopy,
    metadata,
    pullRequests: (issue.pullRequests ?? []).map(pr => ({
      title: pr.title,
      description: pr.description?.trim() || undefined,
    })),
  };
};

const coalesceCuratedCopy = (
  metadata: z.infer<typeof jiraIssueSchema>['additionalMetadata']
): { copy?: string; key?: string } => {
  if (!metadata) {
    return {};
  }

  for (const key of CURATED_COPY_KEYS) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return {
        copy: value.trim(),
        key,
      };
    }
  }

  return {};
};

const extractNonCuratedMetadata = (
  metadata: z.infer<typeof jiraIssueSchema>['additionalMetadata'],
  skipCuratedKey?: string
): Record<string, string> | undefined => {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(
      ([key, value]) =>
        key.length > 0 &&
        (skipCuratedKey ? key !== skipCuratedKey : true) &&
        value !== undefined &&
        value !== null &&
        String(value).trim().length > 0
    );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    entries.map(([key, value]) => [key, String(value).trim()])
  );
};

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
    if (issue.pullRequests.length > 0) {
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

const deriveDefaultFocus = (title: string): string => {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes('improv') ||
    normalizedTitle.includes('enhanc') ||
    normalizedTitle.includes('feature') ||
    normalizedTitle.includes('new') ||
    normalizedTitle.includes('upgrade')
  ) {
    return 'Enhancements and new capabilities that improve the product experience.';
  }

  if (
    normalizedTitle.includes('bug') ||
    normalizedTitle.includes('fix') ||
    normalizedTitle.includes('stability') ||
    normalizedTitle.includes('quality') ||
    normalizedTitle.includes('reliab')
  ) {
    return 'Resolved defects and quality fixes that restore expected behavior.';
  }

  if (
    normalizedTitle.includes('security') ||
    normalizedTitle.includes('vulner') ||
    normalizedTitle.includes('cve') ||
    normalizedTitle.includes('compliance') ||
    normalizedTitle.includes('hardening')
  ) {
    return 'Security and vulnerability remediation items.';
  }

  return `Key updates related to ${title}.`;
};

const isSecurityIssue = (
  issue: z.infer<typeof releaseNotesInputSchema>['jiraIssues'][number]
): boolean => {
  const type = issue.issueType;
  const summary = issue.summary.toLowerCase();

  return (
    type.includes('VULNER') ||
    type.includes('SECURITY') ||
    type.includes('CVE') ||
    summary.includes('cve') ||
    summary.includes('vulnerab') ||
    summary.includes('security')
  );
};

export const releaseNotesAgent = new Agent({
  id: 'release-notes-agent',
  name: 'Release Notes Agent',
  description:
    'Generates structured release note sections using Jira issues and pull request metadata',
  instructions: `You produce structured release notes.

Inputs include Jira issues, optional pull requests, curated metadata, and formatting guidance.

Return ONLY a JSON object matching the provided schema:
{
  "sections": [
    {
      "title": string,
      "items": [
        {
          "text": string,
          "citations"?: string[],
          "subitems"?: [{ ... }]
        }
      ]
    }
  ]
}

  Rules:
  - Use the section titles surfaced in the Section Planner (e.g., Improvements, Bug Fixes).
  - Assign each Jira issue to the section that best matches its change; if none fits perfectly, choose the closest and explain the placement.
  - Every bullet focuses on user-facing impact using the supplied metadata.
  - Use subitems when additional context (like pull requests or follow-on work) improves clarity.
  - Wrap any literal token a user might copy (versions, package names, CLI commands, file paths, environment variables) in single backticks. Do not emit multiline code fences.
  - When hyperlink instructions are present, add entries to the "links" array specifying the exact substring and URL to hyperlink; keep the bullet text itself free of inline markup.
  - Only include a citations array when at least one Jira issue applies to that bullet; omit the field for structural or grouping bullets, but ensure actionable top-level bullets list their supporting Jira keys.
  - Avoid redundant subitems that merely repeat release note URLs or restate the parent bullet; use the links array on the parent bullet instead.
  - Never include markdown fences or explanatory prose around the JSON.`,
  defaultGenerateOptions: {
    output: releaseNotesOutputSchema,
    temperature: 0.3, // Low temperature for consistency, but allow some creativity
  },
  model: gpt41,
});

type ReleaseNotesAgentGenerateOptions = Parameters<
  typeof releaseNotesAgent.generate
>[1];
type ReleaseNotesAgentResult = Awaited<
  ReturnType<typeof releaseNotesAgent.generate>
>;

/**
 * Generate structured release notes given schema-compliant input.
 * @param input - Release metadata to transform into structured release notes.
 * @param [options] - Optional overrides forwarded to the underlying Mastra agent.
 * @param [options.runtimeContext] - Runtime context instance used when invoking the agent.
 * @param [options.tracingOptions] - Tracing configuration that controls span metadata.
 * @returns Promise resolving to the validated structured release notes result.
 */
export const generateReleaseNotes = async (
  input: z.infer<typeof releaseNotesInputSchema>,
  options?: ReleaseNotesAgentGenerateOptions
): Promise<ReleaseNotesAgentResult> => {
  const formattedInput = formatInputForAgent(input);
  const result = await releaseNotesAgent.generate(formattedInput, options);

  if (result.object) {
    return {
      ...result,
      object: releaseNotesOutputSchema.parse(result.object),
    };
  }

  if (!result.text) {
    throw new Error('Release notes agent did not return any output text.');
  }

  try {
    const parsed = JSON.parse(result.text);
    const validated = releaseNotesOutputSchema.parse(parsed);
    return {
      ...result,
      object: validated,
    };
  } catch (error) {
    throw new Error(
      'Release notes agent returned unparseable JSON output',
      error instanceof Error ? { cause: error } : undefined
    );
  }
};

/**
 * Format release notes input data into a planner-informed prompt for the agent.
 * @param input - Release metadata that should be converted into a prompt.
 * @returns Prompt string that summarises the section planner and requirements.
 */
const formatInputForAgent = (
  input: z.infer<typeof releaseNotesInputSchema>
): string => {
  const sectionPlans = buildReleaseNotesSectionPlans(input);
  const sectionPlanner = formatSectionPlansForPrompt(sectionPlans);

  const metadataLines = ['# Release Notes Source Data'];

  if (input.customGuidelines && input.customGuidelines.trim().length > 0) {
    metadataLines.push('Custom guidelines:');
    metadataLines.push(input.customGuidelines.trim());
  }

  const requirements: string[] = [
    'Return valid JSON that exactly matches the schema provided in your system prompt.',
    'Use the section titles surfaced in the Section Planner. Add new sections only when the data strongly suggests a distinct category.',
    'Assign each issue to the section that best matches its change; if no section is a perfect fit, choose the closest match and make the rationale clear in the bullet text.',
    'Summarize each bullet in one or two sentences that highlight user-facing impact.',
    'Prefer curated copy fields (release_notes, customer_impact, upgrade_notes) when present; otherwise synthesize text from summaries, descriptions, and metadata.',
    'Do not invent details beyond what appears in the planner.',
    'Use subitems for supporting context such as grouped vulnerabilities, follow-on tasks, or pull request details.',
    'Wrap tokens that a user might copy verbatim (versions, package names, CLI commands, file paths, environment variables) in single backticks; avoid multiline code fences.',
    'When hyperlink guidance is available (for example in metadata or guidelines), populate the links array with { "text", "url" } objects instead of embedding inline markup.',
    'Keep bullet text plain prose (no markdown, Jira formatting, or decorative prefixes).',
    'Include a citations array only when at least one Jira issue applies to that bullet; omit the field for structural or grouping bullets, but ensure actionable top-level bullets cite their supporting Jira keys.',
    'Omit the citations property on subitems only when they inherit the citation from their parent bullet.',
    'Do not create subitems that only point to additional reading (for example, “See the release notes”). Capture URLs via the links array on the relevant bullet instead.',
  ];

  requirements.push(
    'If a section plan instructs you to group vulnerabilities, use a parent bullet with subitems for the individual CVEs.'
  );
  requirements.push(
    'For pull requests listed under an issue, prefer subitems that briefly describe the change and cite the parent issue.'
  );

  return [
    metadataLines.join('\n'),
    '# Section Planner',
    sectionPlanner,
    '# Output Requirements',
    requirements.map(line => `- ${line}`).join('\n'),
  ].join('\n\n');
};

export const askReleaseNotesAgentTool = createToolFromAgent(
  RELEASE_NOTES_AGENT_NAME,
  releaseNotesAgent.getDescription(),
  releaseNotesOutputSchema
);

// Export schemas for use in routes/workflows
export {
  releaseNotesInputSchema,
  releaseNotesOutputSchema,
  jiraIssueSchema,
  pullRequestSchema,
  buildReleaseNotesSectionPlans,
};

export type {
  ReleaseNotesItem,
  ReleaseNotesSection,
  ReleaseNotesOutput,
  ReleaseNotesLink,
  SectionPlan,
  SectionPlanIssue,
  SectionPlannerContext,
};
