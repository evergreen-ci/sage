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
  product: z
    .string()
    .min(1, 'Product name must not be empty.')
    .optional()
    .describe(
      'Product name (e.g., "ops-manager", "mongodb-agent"). Used for tracking and logging purposes.'
    ),
  jiraIssues: z
    .array(jiraIssueSchema)
    .min(1, 'At least one Jira issue is required.')
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

const itemHasRequiredCitations = (item: ReleaseNotesItem): boolean => {
  const citations =
    item.citations?.map(candidate => candidate.trim()).filter(Boolean) ?? [];

  if (citations.length > 0) {
    return true;
  }

  const subitems = item.subitems ?? [];
  if (subitems.length === 0) {
    return false;
  }

  return subitems.every(itemHasRequiredCitations);
};

export const validateReleaseNotesCitations = (
  output: ReleaseNotesOutput
): void => {
  for (const section of output.sections) {
    for (const item of section.items) {
      if (!itemHasRequiredCitations(item)) {
        throw new Error(
          `Release notes item "${item.text}" in section "${section.title}" is missing required citations.`
        );
      }
    }
  }
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
  const sections = (input.sections ?? DEFAULT_SECTION_TITLES).map(title => ({
    title,
    focus: deriveDefaultFocus(title),
  }));

  const issues = (input.jiraIssues ?? []).map(createSectionPlanIssue);

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

const deriveDefaultFocus = (title: string): string => {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes('improvement') ||
    normalizedTitle.includes('improves') ||
    normalizedTitle.includes('enhancement') ||
    normalizedTitle.includes('enhances') ||
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
    normalizedTitle.includes('reliability')
  ) {
    return 'Resolved defects and quality fixes that restore expected behavior.';
  }

  if (
    normalizedTitle.includes('security') ||
    normalizedTitle.includes('vulnerability') ||
    normalizedTitle.includes('vulnerable') ||
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
    summary.includes('vulnerability') ||
    summary.includes('vulnerable') ||
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

CRITICAL SCHEMA REQUIREMENTS:
- Return ONLY a JSON object with EXACTLY this structure (no other top-level fields):
{
  "sections": [
    {
      "title": "Section Title",
      "items": [
        {
          "text": "Item text content",
          "citations": ["JIRA-123"],
          "subitems": [
            {
              "text": "Subitem text",
              "citations": ["JIRA-456"]
            }
          ],
          "links": [
            {
              "text": "Link text",
              "url": "https://example.com"
            }
          ]
        }
      ]
    }
  ]
}

Note: Optional fields (citations, subitems, links) may be omitted entirely if not needed.
If citations array is present, it must be non-empty. Do not include empty arrays.

- Do NOT include any fields outside of "sections" at the top level (e.g., no "links", "metadata", etc.)
- Do NOT include empty arrays for citations - omit the field entirely if there are no citations. NEVER include "citations": [] - this will cause validation to fail.
- Do NOT use "title" for items - ALWAYS use "text" for item content (only sections use "title")
- Do NOT include markdown fences, explanatory text, or any content outside the JSON object

Rules:
- Use the section titles surfaced in the Section Planner (e.g., Improvements, Bug Fixes).
- Assign each Jira issue to the section that best matches its change; if none fits perfectly, choose the closest and explain the placement.
- Every bullet focuses on user-facing impact using the supplied metadata.
- Use subitems when additional context (like pull requests or follow-on work) improves clarity.
- Wrap any literal token a user might copy (versions, package names, CLI commands, file paths, environment variables) in single backticks. Do not emit multiline code fences.
- When hyperlink instructions are present, add entries to the "links" array on the specific item (not at top level) specifying the exact substring and URL to hyperlink; keep the bullet text itself free of inline markup.
- Only include a citations array when at least one Jira issue applies to that bullet; omit the field entirely for structural or grouping bullets, but ensure actionable top-level bullets list their supporting Jira keys.
- Do NOT include Jira ticket keys (e.g., "CLOUDP-12345") in the "text" fields - the citations array already contains these keys, so mentioning them in the text is redundant.
- Avoid redundant subitems that merely repeat release note URLs or restate the parent bullet; use the links array on the parent bullet instead.`,
  defaultOptions: {
    structuredOutput: {
      schema: releaseNotesOutputSchema,
    },
    modelSettings: {
      temperature: 0.3, // Low temperature for consistency, but allow some creativity
    },
  },
  model: gpt41,
});

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
