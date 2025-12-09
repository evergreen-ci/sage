import { Agent, AgentMemoryOption } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import { createToolFromAgent } from '@/mastra/tools/utils';
import { memoryStore } from '@/mastra/utils/memory';
import { logger } from '@/utils/logger';
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
      'Product name (e.g., "ops-manager", "mongodb-agent"). If provided, enables product-specific memory learning.'
    ),
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

type UnknownRecord = Record<string, unknown>;

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

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const firstNonEmptyString = (
  record: UnknownRecord,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return undefined;
};

const toOptionalArray = (value: unknown): unknown[] | undefined => {
  if (Array.isArray(value)) {
    return value;
  }
  return undefined;
};

const normalizeCitations = (value: unknown): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized: string[] = [];

  const addCitation = (candidate: unknown) => {
    if (!isNonEmptyString(candidate)) {
      return;
    }
    normalized.push(candidate.trim());
  };

  if (Array.isArray(value)) {
    value.forEach(addCitation);
  } else if (isNonEmptyString(value)) {
    value
      .split(/[,|\n]/)
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => normalized.push(part));
  }

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : undefined;
};

const normalizeLinks = (value: unknown): ReleaseNotesLink[] | undefined => {
  if (!value) {
    return undefined;
  }

  let entries: unknown[] = [];

  if (Array.isArray(value)) {
    entries = value;
  } else if (value && typeof value === 'object') {
    entries = [value];
  }

  const links = entries
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return undefined;
      }

      const record = entry as UnknownRecord;
      const text = firstNonEmptyString(record, ['text', 'label', 'name']);
      const url = firstNonEmptyString(record, ['url', 'href', 'link']);

      if (!text || !url) {
        return undefined;
      }

      return {
        text,
        url,
      };
    })
    .filter((candidate): candidate is ReleaseNotesLink => Boolean(candidate));

  return links.length > 0 ? links : undefined;
};

const normalizeReleaseNotesItem = (
  value: unknown
): ReleaseNotesItem | undefined => {
  if (!value) {
    return undefined;
  }

  if (isNonEmptyString(value)) {
    return { text: value.trim() };
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  const record = value as UnknownRecord;
  const text =
    firstNonEmptyString(record, ['text', 'title', 'summary', 'description']) ??
    undefined;

  if (!text) {
    return undefined;
  }

  const citations =
    normalizeCitations(
      record.citations ??
        record.citation ??
        record.issueKeys ??
        record.issues ??
        record.jira
    ) ?? undefined;

  const subitemsRaw =
    toOptionalArray(record.subitems) ??
    toOptionalArray(record.children) ??
    toOptionalArray(record.items);

  const subitems = subitemsRaw
    ?.map(normalizeReleaseNotesItem)
    .filter((candidate): candidate is ReleaseNotesItem => Boolean(candidate));

  const links =
    normalizeLinks(record.links ?? record.link ?? record.references) ??
    undefined;

  const item: ReleaseNotesItem = {
    text,
  };

  if (citations && citations.length > 0) {
    item.citations = citations;
  }

  if (subitems && subitems.length > 0) {
    item.subitems = subitems;
  }

  if (links && links.length > 0) {
    item.links = links;
  }

  return item;
};

const normalizeReleaseNotesSection = (
  value: unknown
): ReleaseNotesSection | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as UnknownRecord;
  const title =
    firstNonEmptyString(record, ['title', 'name', 'heading']) ?? undefined;

  if (!title) {
    return undefined;
  }

  const itemsRaw =
    toOptionalArray(record.items) ??
    toOptionalArray(record.bullets) ??
    toOptionalArray(record.entries);

  if (!itemsRaw) {
    return undefined;
  }

  const items = itemsRaw
    .map(normalizeReleaseNotesItem)
    .filter((candidate): candidate is ReleaseNotesItem => Boolean(candidate));

  if (items.length === 0) {
    return undefined;
  }

  return {
    title,
    items,
  };
};

export const normalizeReleaseNotesOutput = (
  raw: unknown
): ReleaseNotesOutput | undefined => {
  if (!raw) {
    return undefined;
  }

  if (typeof raw === 'string') {
    try {
      return normalizeReleaseNotesOutput(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }

  let sectionsSource: unknown;

  if (Array.isArray(raw)) {
    // If raw is an array, treat it as sections directly
    sectionsSource = raw;
  } else if (typeof raw === 'object') {
    const record = raw as UnknownRecord;
    // Extract only the 'sections' field, ignore all other top-level fields (like 'links')
    if (Array.isArray(record.sections)) {
      sectionsSource = record.sections;
    } else if (
      record.sections &&
      typeof record.sections === 'object' &&
      !Array.isArray(record.sections)
    ) {
      // Handle case where sections is an object with section titles as keys
      sectionsSource = Object.entries(record.sections as UnknownRecord).map(
        ([title, items]) => ({
          title,
          items,
        })
      );
    } else {
      // No valid sections field found, return undefined
      return undefined;
    }
  } else {
    return undefined;
  }

  if (!sectionsSource || !Array.isArray(sectionsSource)) {
    return undefined;
  }

  const sections = sectionsSource
    .map(normalizeReleaseNotesSection)
    .filter((candidate): candidate is ReleaseNotesSection =>
      Boolean(candidate)
    );

  if (sections.length === 0) {
    return undefined;
  }

  // Return only the sections field, explicitly excluding any other fields
  return {
    sections,
  };
};

type ReleaseNotesValidationContext = {
  source: 'object' | 'text';
  rawText?: string;
};

/**
 * Strips unknown top-level fields from the output, keeping only 'sections'
 * @param value - The value to strip unknown fields from
 * @returns The value with only 'sections' field at top level, or original value if not an object
 */
const stripUnknownFields = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as UnknownRecord;
  if ('sections' in record) {
    return {
      sections: record.sections,
    };
  }

  return value;
};

/**
 * Recursively converts 'title' to 'text' for items that have 'title' but no 'text'
 * This handles cases where the LLM incorrectly uses 'title' instead of 'text' for items
 * @param value - The value to convert (can be object, array, or primitive)
 * @returns The converted value with 'title' converted to 'text' for items (sections keep 'title')
 */
const convertTitleToText = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(convertTitleToText);
  }

  const record = value as UnknownRecord;

  // Check if this is a section (has 'title' AND 'items' array) - sections keep 'title'
  const isSection =
    'title' in record &&
    'items' in record &&
    Array.isArray(record.items) &&
    typeof record.title === 'string';

  // Check if this is an item that incorrectly uses 'title' instead of 'text'
  const hasTitle = 'title' in record && typeof record.title === 'string';
  const hasText = 'text' in record && typeof record.text === 'string';
  const needsConversion = hasTitle && !hasText && !isSection;

  // If we need to convert, do it upfront
  if (needsConversion) {
    const converted: UnknownRecord = {
      text: record.title, // Convert 'title' to 'text'
    };

    // Copy all other fields recursively, skipping 'title'
    for (const [key, val] of Object.entries(record)) {
      if (key === 'title') {
        continue; // Skip the original 'title' field
      }

      // Recursively clean nested objects/arrays
      if (val !== null && val !== undefined && typeof val === 'object') {
        converted[key] = convertTitleToText(val);
      } else {
        converted[key] = val;
      }
    }

    return converted;
  }

  // No conversion needed, process normally
  const cleaned: UnknownRecord = {};
  for (const [key, val] of Object.entries(record)) {
    // Recursively clean nested objects/arrays
    if (val !== null && val !== undefined && typeof val === 'object') {
      cleaned[key] = convertTitleToText(val);
    } else {
      cleaned[key] = val;
    }
  }

  return cleaned;
};

/**
 * Recursively removes empty citations arrays from items to prevent schema validation failures
 * Uses JSON parse/stringify as a more reliable way to deep clone and clean
 * @param value - The value to clean (can be object, array, or primitive)
 * @returns The cleaned value with empty citations arrays removed
 */
const cleanEmptyCitations = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  // Use JSON round-trip for reliable deep cleaning
  try {
    const jsonString = JSON.stringify(value, (key, val) => {
      // Remove empty citations arrays during stringification
      if (key === 'citations' && Array.isArray(val) && val.length === 0) {
        return undefined; // Omit this property
      }
      return val;
    });
    return JSON.parse(jsonString);
  } catch {
    // Fallback to manual cleaning if JSON round-trip fails
    if (Array.isArray(value)) {
      return value.map(cleanEmptyCitations).filter(item => item !== undefined);
    }

    const record = value as UnknownRecord;
    const cleaned: UnknownRecord = {};

    for (const [key, val] of Object.entries(record)) {
      // Skip empty citations arrays
      if (key === 'citations' && Array.isArray(val) && val.length === 0) {
        continue;
      }

      // Recursively clean all nested objects/arrays
      if (val !== null && val !== undefined && typeof val === 'object') {
        const cleanedVal = cleanEmptyCitations(val);
        if (cleanedVal !== undefined) {
          cleaned[key] = cleanedVal;
        }
      } else {
        cleaned[key] = val;
      }
    }

    return cleaned;
  }
};

const ensureReleaseNotesOutput = (
  value: unknown,
  context: ReleaseNotesValidationContext
): ReleaseNotesOutput => {
  // Convert 'title' to 'text' for items FIRST - handles LLM mistakes
  const titleConverted = convertTitleToText(value);

  // Clean empty citations - this is critical to prevent validation failures
  const preCleaned = cleanEmptyCitations(titleConverted);

  // Then strip any unknown top-level fields
  const stripped = stripUnknownFields(preCleaned);

  // Clean empty citations again after stripping (should be redundant but safe)
  const cleaned = cleanEmptyCitations(stripped);

  // Then try to normalize/repair the output
  const normalized = normalizeReleaseNotesOutput(cleaned) ?? cleaned;

  // Convert title to text again after normalization (in case normalization didn't catch it)
  const titleConvertedAgain = convertTitleToText(normalized);

  // Clean empty citations again after normalization (normalization might reintroduce them)
  const finalCleaned = cleanEmptyCitations(titleConvertedAgain);

  // Debug: Log if we still have empty citations after cleaning
  const hasEmptyCitations =
    JSON.stringify(finalCleaned).includes('"citations":[]');
  if (hasEmptyCitations) {
    logger.warn(
      'Found empty citations after cleaning - this should not happen',
      {
        source: context.source,
        cleanedValue: JSON.stringify(finalCleaned).substring(0, 500),
      }
    );
  }

  // Try validation on normalized output
  let validation = releaseNotesOutputSchema.safeParse(finalCleaned);

  // If validation fails due to empty citations, try one more aggressive clean
  if (!validation.success) {
    const hasEmptyCitationsError = validation.error.issues.some(
      issue =>
        issue.path.includes('citations') &&
        (issue.message.includes('non-empty') || issue.message.includes('empty'))
    );

    if (hasEmptyCitationsError) {
      logger.warn(
        'Validation failed due to empty citations, attempting aggressive clean',
        {
          source: context.source,
        }
      );
      const aggressivelyCleaned = cleanEmptyCitations(finalCleaned);
      validation = releaseNotesOutputSchema.safeParse(aggressivelyCleaned);
    }
  }

  if (validation.success) {
    validateReleaseNotesCitations(validation.data);
    // Log if normalization was needed
    if (finalCleaned !== value) {
      logger.warn('Auto-repaired release notes agent output', {
        source: context.source,
      });
    }
    return validation.data;
  }

  // If normalization didn't help, try one more aggressive pass
  const repaired = normalizeReleaseNotesOutput(cleaned);
  if (repaired && repaired !== finalCleaned) {
    // Clean empty citations from repaired output too
    const cleanedRepaired = cleanEmptyCitations(repaired);
    const repairedValidation =
      releaseNotesOutputSchema.safeParse(cleanedRepaired);
    if (repairedValidation.success) {
      validateReleaseNotesCitations(repairedValidation.data);
      logger.warn('Auto-repaired release notes agent output (second pass)', {
        source: context.source,
        issueCount: validation.error.issues.length,
      });
      return repairedValidation.data;
    }
    // If repair failed, log the repair validation error
    logger.error('Normalized output still failed validation', {
      source: context.source,
      repairIssues: repairedValidation.error.issues,
      originalIssues: validation.error.issues,
    });
  } else {
    logger.error('Failed to normalize release notes output', {
      source: context.source,
      originalIssues: validation.error.issues,
      validationErrors: validation.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    });
  }

  const errorMessage = `Release notes agent returned output that does not match the expected schema. ${validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`;

  logger.error('Release notes validation failed', {
    source: context.source,
    errorMessage,
    validationIssues: validation.error.issues,
    rawValue: JSON.stringify(value, null, 2).substring(0, 1000), // First 1000 chars for debugging
  });

  throw new Error(errorMessage, { cause: validation.error });
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

const releaseNotesAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'resource', // Product-level learning - all releases for a product share memory
      enabled: true,
      template: `# Release Notes Context - {{product}}

## Product-Specific Patterns Learned Over Time
{{#learnedPatterns}}
- {{learnedPatterns}}
{{/learnedPatterns}}

## Style Preferences
{{#stylePreferences}}
- {{stylePreferences}}
{{/stylePreferences}}

## Common Feedback & Corrections
{{#feedback}}
- {{feedback}}
{{/feedback}}
`,
    },
    threads: {
      generateTitle: false,
    },
  },
});

export const releaseNotesAgent = new Agent({
  id: 'release-notes-agent',
  name: 'Release Notes Agent',
  description:
    'Generates structured release note sections using Jira issues and pull request metadata',
  memory: releaseNotesAgentMemory,
  instructions: `You produce structured release notes.

Inputs include Jira issues, optional pull requests, curated metadata, and formatting guidance.

CRITICAL SCHEMA REQUIREMENTS:
- Return ONLY a JSON object with EXACTLY this structure (no other top-level fields):
{
  "sections": [
    {
      "title": string,
      "items": [
        {
          "text": string,  // REQUIRED: Use "text" NOT "title" for items
          "citations"?: string[] (non-empty if present),
          "subitems"?: [{ "text": string, "citations"?: string[], ... }],
          "links"?: [{ "text": string, "url": string }]
        }
      ]
    }
  ]
}

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
 * @param [options.memory] - Memory options for product-specific context.
 * @returns Promise resolving to the validated structured release notes result.
 */
export const generateReleaseNotes = async (
  input: z.infer<typeof releaseNotesInputSchema>,
  options?: ReleaseNotesAgentGenerateOptions & {
    memory?: AgentMemoryOption;
  }
): Promise<ReleaseNotesAgentResult> => {
  const formattedInput = formatInputForAgent(input);

  // Ensure structured output is always requested
  const { memory, ...restOptions } = options || {};
  const generateOptions: ReleaseNotesAgentGenerateOptions = {
    ...restOptions,
    structuredOutput: {
      schema: releaseNotesOutputSchema,
    },
    ...(memory ? { memory } : {}),
  };

  const maxRetries = 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Retries must be sequential
      const result = await releaseNotesAgent.generate(
        formattedInput,
        attempt === 0
          ? generateOptions
          : {
              ...generateOptions,
              // On retry, add more explicit instructions
              system: `CRITICAL: Return ONLY valid JSON matching this exact schema. Do not include any fields outside of "sections". Each section must have "title" and "items". Each item MUST use "text" (NOT "title") for the item content. Only sections use "title" - items always use "text". Each item must have "text" and optionally "citations" (non-empty array if present), "subitems", and "links". NEVER include "citations": [] - if there are no citations, omit the citations field entirely. Remove any top-level fields other than "sections".`,
            }
      );

      // Prefer structured output if available
      if (result.object) {
        const validated = ensureReleaseNotesOutput(result.object, {
          source: 'object',
        });
        return {
          ...result,
          object: validated,
        };
      }

      // Fallback to parsing text if structured output not available
      if (result.text) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(result.text);
        } catch (parseError) {
          throw new Error(
            'Release notes agent returned unparseable JSON output.',
            parseError instanceof Error ? { cause: parseError } : undefined
          );
        }

        const validated = ensureReleaseNotesOutput(parsed, {
          source: 'text',
          rawText: result.text,
        });
        return {
          ...result,
          object: validated,
        };
      }

      throw new Error('Release notes agent did not return any output.');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt or error is not validation-related, throw
      if (
        attempt === maxRetries ||
        !lastError.message.includes('does not match the expected schema')
      ) {
        throw lastError;
      }

      // Log retry attempt
      logger.warn('Release notes validation failed, retrying', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        error: lastError.message,
      });
    }
  }

  // This should never be reached, but TypeScript needs it
  throw (
    lastError || new Error('Failed to generate release notes after retries')
  );
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
    'Do not include Jira ticket keys (e.g., "CLOUDP-12345") in the "text" fields - the citations array already contains these keys, so mentioning them in the text is redundant.',
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
