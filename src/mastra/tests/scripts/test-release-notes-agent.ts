#!/usr/bin/env vite-node --script

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  buildReleaseNotesSectionPlans,
  generateReleaseNotes,
  releaseNotesInputSchema,
  releaseNotesOutputSchema,
  type ReleaseNotesItem,
  type ReleaseNotesSection,
} from '@/mastra/agents/releaseNotesAgent';

type LegacyMessage = {
  content: string;
  role: string;
};

type LegacyPayload = {
  data?: string;
  messages?: LegacyMessage[];
  stream?: boolean;
};

type LegacyJiraFields = {
  issue_description?: unknown;
  issue_key?: unknown;
  issue_release_notes?: unknown;
  issue_summary?: unknown;
  issue_type?: unknown;
  [key: string]: unknown;
};

type LegacyPullRequest = {
  title?: unknown;
  description?: unknown;
};

type LegacyMessagePayload = {
  jira?: LegacyJiraFields;
  github?: {
    pull_requests?: LegacyPullRequest[];
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REQUEST_PATH = path.resolve(
  __dirname,
  '../data/sample-release-notes-input.json'
);

const args = process.argv.slice(2);
const getArgValue = (flag: string) => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
};

const requestPathArg =
  getArgValue('--request') ?? getArgValue('--legacy-request');
const outputPath = getArgValue('--write');
const showPlan = args.includes('--show-plan');
const sectionsArg = getArgValue('--sections');

const requestPath = requestPathArg
  ? path.resolve(requestPathArg)
  : DEFAULT_REQUEST_PATH;

if (!fs.existsSync(requestPath)) {
  console.error(
    `❌ Request file not found at "${requestPath}". Pass --request <path> (or legacy --legacy-request) or copy the sample from ${DEFAULT_REQUEST_PATH}.`
  );
  process.exit(1);
}

const rawFile = fs.readFileSync(requestPath, 'utf-8');

let parsedContent: unknown;
try {
  parsedContent = JSON.parse(rawFile);
} catch (error) {
  console.error('❌ Failed to parse payload file as JSON:', error);
  process.exit(1);
}

const looksLikeReleaseNotesInput = (
  payload: unknown
): payload is z.infer<typeof releaseNotesInputSchema> => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return Array.isArray(record.jiraIssues);
};

const extractLegacyPayload = (payload: unknown): LegacyPayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const maybeLegacy = payload as LegacyPayload;

  if (typeof maybeLegacy.data === 'string') {
    try {
      const inner = JSON.parse(maybeLegacy.data);
      return extractLegacyPayload(inner);
    } catch (error) {
      console.error('❌ Failed to parse payload.data as JSON:', error);
      process.exit(1);
    }
  }

  if (Array.isArray(maybeLegacy.messages)) {
    return maybeLegacy;
  }

  return null;
};

const transformLegacyRequest = (
  messages: LegacyMessage[],
  sectionsOverride?: z.infer<typeof releaseNotesInputSchema>['sections']
): z.infer<typeof releaseNotesInputSchema> => {
  const jiraIssues: z.infer<typeof releaseNotesInputSchema>['jiraIssues'] = [];

  let customGuidelines: string | undefined;

  const instructionsMessage = messages[0]?.content ?? '';
  const guidelinesIndex = instructionsMessage.indexOf('# Guidelines');
  if (guidelinesIndex !== -1) {
    customGuidelines = instructionsMessage
      .slice(guidelinesIndex + '# Guidelines'.length)
      .trim();
  }

  for (const message of messages.slice(1)) {
    let messagePayload: LegacyMessagePayload;
    try {
      messagePayload = JSON.parse(message.content) as LegacyMessagePayload;
    } catch {
      continue;
    }

    if (!messagePayload.jira) {
      continue;
    }

    const {
      issue_description: issueDescription,
      issue_key: issueKey,
      issue_release_notes: issueReleaseNotes,
      issue_summary: issueSummary,
      issue_type: issueType,
      ...additionalFields
    } = messagePayload.jira;

    if (!issueKey || !issueType || !issueSummary) {
      continue;
    }

    const additionalMetadata: Record<string, string> = {};

    if (typeof issueReleaseNotes === 'string' && issueReleaseNotes.trim()) {
      additionalMetadata.release_notes = issueReleaseNotes;
    }

    for (const [rawKey, value] of Object.entries(
      additionalFields as Record<string, unknown>
    )) {
      if (value == null) continue;
      if (typeof value === 'string' || typeof value === 'number') {
        additionalMetadata[rawKey] = String(value);
      }
    }

    const issue: z.infer<typeof releaseNotesInputSchema>['jiraIssues'][number] =
      {
        key: String(issueKey),
        issueType: String(issueType).toUpperCase(),
        summary: String(issueSummary),
        description:
          typeof issueDescription === 'string' ? issueDescription : undefined,
        additionalMetadata:
          Object.keys(additionalMetadata).length > 0
            ? additionalMetadata
            : undefined,
      };

    const prs = messagePayload.github?.pull_requests ?? [];
    const embeddedPRs: NonNullable<
      z.infer<
        typeof releaseNotesInputSchema
      >['jiraIssues'][number]['pullRequests']
    > = [];
    for (const pr of prs) {
      if (!pr?.title) {
        continue;
      }
      embeddedPRs.push({
        title: String(pr.title),
        description: typeof pr.description === 'string' ? pr.description : '',
      });
    }

    if (embeddedPRs.length > 0) {
      issue.pullRequests = embeddedPRs;
    }

    jiraIssues.push(issue);
  }

  if (jiraIssues.length === 0) {
    throw new Error('No Jira issues were found in the legacy request payload.');
  }

  const releaseNotesInput = releaseNotesInputSchema.parse({
    jiraIssues,
    sections: sectionsOverride,
    customGuidelines,
  });

  return releaseNotesInput;
};

const run = async () => {
  console.log('🧪 Running releaseNotesAgent test\n');
  console.log(`• Request file: ${requestPath}`);
  const sectionsOverride = sectionsArg
    ? releaseNotesInputSchema.shape.sections.parse(
        sectionsArg
          .split(',')
          .map(value => value.trim())
          .filter(value => value.length > 0)
      )
    : undefined;

  const sectionsLabel = sectionsOverride
    ? sectionsOverride.join(', ')
    : 'default (Improvements, Bug Fixes)';
  console.log(`• Sections: ${sectionsLabel}`);
  console.log(`• Section planner preview: ${showPlan ? 'yes' : 'no'}`);

  let input: z.infer<typeof releaseNotesInputSchema>;

  if (looksLikeReleaseNotesInput(parsedContent)) {
    console.log('• Detected direct releaseNotesAgent payload\n');
    input = releaseNotesInputSchema.parse(parsedContent);
  } else {
    const legacyPayload = extractLegacyPayload(parsedContent);
    if (!legacyPayload) {
      console.error(
        '❌ Payload does not contain releaseNotesAgent input or legacy Mongogpt messages.'
      );
      process.exit(1);
    }

    const legacyMessages = legacyPayload.messages ?? [];
    if (legacyMessages.length === 0) {
      console.error('❌ No messages found in the legacy payload.');
      process.exit(1);
    }

    console.log('• Detected legacy Mongogpt-style payload, transforming...\n');
    input = transformLegacyRequest(legacyMessages, sectionsOverride);
  }

  if (sectionsOverride) {
    input = {
      ...input,
      sections: sectionsOverride,
    };
  }

  if (showPlan) {
    const plannerContext = buildReleaseNotesSectionPlans(input);
    printSectionPlanner(plannerContext);
  }

  const { object: agentOutput } = await generateReleaseNotes(input);

  if (!agentOutput) {
    console.error('❌ Agent returned no structured output.');
    process.exit(1);
  }

  const structuredOutput = releaseNotesOutputSchema.parse(agentOutput);

  const missingCitations = findSectionsWithMissingTopLevelCitations(
    structuredOutput.sections
  );

  if (missingCitations.length > 0) {
    console.error(
      [
        '❌ Structured output is missing citations for top-level bullets in these sections:',
        ...missingCitations.map(citationPath => `  • ${citationPath}`),
        '',
        'Every top-level bullet must list supporting Jira issue keys in the citations array.',
      ].join('\n')
    );
    process.exit(1);
  }

  const invalidLinks = findInvalidLinks(structuredOutput.sections);
  if (invalidLinks.length > 0) {
    console.error(
      [
        '❌ Structured output contains hyperlink entries whose text does not appear in the bullet:',
        ...invalidLinks.map(linkPath => `  • ${linkPath}`),
        '',
        'Ensure every link.text substring exists within the corresponding bullet text.',
      ].join('\n')
    );
    process.exit(1);
  }

  const citationViolations = findInvalidCitationStructure(
    structuredOutput.sections
  );
  if (citationViolations.length > 0) {
    console.error(
      [
        '❌ Structured output has bullets without Jira citations:',
        ...citationViolations.map(violationPath => `  • ${violationPath}`),
        '',
        'Every actionable bullet must cite at least one Jira issue; only pure grouping bullets may omit citations.',
      ].join('\n')
    );
    process.exit(1);
  }

  printSummary(structuredOutput.sections);

  const resultJson = JSON.stringify(structuredOutput, null, 2);

  if (outputPath) {
    const resolvedPath = path.resolve(outputPath);
    fs.writeFileSync(resolvedPath, resultJson);
    console.log(`\n✅ Success! Wrote release notes to ${resolvedPath}`);
  } else {
    console.log('\n✅ Success! Agent output:\n');
    console.log(resultJson);
  }
};

run().catch(error => {
  console.error('❌ Failed to run releaseNotesAgent test:', error);
  process.exit(1);
});

/**
 * Log the derived section planner summary to aid manual inspection of the CLI output.
 * @param context - Section planner context containing section information and raw issues.
 */
function printSectionPlanner(
  context: ReturnType<typeof buildReleaseNotesSectionPlans>
) {
  console.log('\n🧭 Section Planner\n');
  console.log('Sections:');
  context.sections.forEach((section, index) => {
    const label = `${index + 1}. ${section.title}`;
    console.log(section.focus ? `${label} — ${section.focus}` : label);
  });

  console.log('\nIssues:');
  context.issues.forEach(issue => {
    console.log(`- ${issue.key} (${issue.issueType}): ${issue.summary}`);
    if (issue.curatedCopy) {
      console.log(`    curated: ${issue.curatedCopy}`);
    }
  });

  if (context.hasSecurityIssues) {
    console.log(
      '\n• Security-related issues detected. Consider grouping CVE fixes under a parent bullet such as "Fixes the following CVEs:".'
    );
  }

  console.log('');
}

/**
 * Print a concise summary of the generated release notes, including bullet and link counts.
 * @param sections - Structured release notes sections produced by the agent.
 */
function printSummary(sections: ReleaseNotesSection[]) {
  console.log('\n📋 Structured Output Summary\n');
  for (const section of sections) {
    const itemCount = countItems(section.items);
    const linkCount = countLinks(section.items);
    const linkLabel =
      linkCount === 0
        ? 'no links'
        : `${linkCount} link${linkCount === 1 ? '' : 's'}`;
    console.log(
      `- ${section.title}: ${itemCount} bullet${itemCount === 1 ? '' : 's'}, ${linkLabel}`
    );
  }
}

/**
 * Count the number of bullet items, traversing nested subitems recursively.
 * @param items - Release notes items to inspect.
 * @returns Total bullet count including subitems.
 */
function countItems(items: ReleaseNotesItem[]): number {
  return items.reduce((acc, item) => {
    const subCount = item.subitems ? countItems(item.subitems) : 0;
    return acc + 1 + subCount;
  }, 0);
}

/**
 * Count the number of hyperlink definitions across all items and subitems.
 * @param items - Release notes items to scan for links.
 * @returns Total number of links present.
 */
function countLinks(items: ReleaseNotesItem[]): number {
  return items.reduce((acc, item) => {
    const own = item.links?.length ?? 0;
    const sub = item.subitems ? countLinks(item.subitems) : 0;
    return acc + own + sub;
  }, 0);
}

/**
 * Determine which sections retain top-level bullets that do not cite any Jira issues.
 * @param sections - Structured release notes sections to validate.
 * @returns Section titles that include uncited top-level bullets.
 */
function findSectionsWithMissingTopLevelCitations(
  sections: ReleaseNotesSection[]
): string[] {
  const missing: string[] = [];

  for (const section of sections) {
    const hasMissing = section.items.some(
      item =>
        (!item.citations || item.citations.length === 0) &&
        (!item.subitems || item.subitems.length === 0)
    );
    if (hasMissing) {
      missing.push(section.title);
    }
  }

  return missing;
}

/**
 * Identify bullets that include link metadata whose text does not appear in the rendered string.
 * @param sections - Structured release notes sections to inspect.
 * @returns Human-readable paths identifying invalid link definitions.
 */
function findInvalidLinks(sections: ReleaseNotesSection[]): string[] {
  const invalid: string[] = [];

  const traverseLinks = (
    items: ReleaseNotesItem[],
    segments: string[]
  ): void => {
    items.forEach((item, index) => {
      const currentSegments = [...segments, `item ${index + 1}`];
      item.links?.forEach((link, linkIndex) => {
        if (!item.text.includes(link.text)) {
          invalid.push(
            `${currentSegments.join(' › ')} (link ${linkIndex + 1})`
          );
        }
      });
      if (item.subitems && item.subitems.length > 0) {
        traverseLinks(item.subitems, [...currentSegments, 'subitems']);
      }
    });
  };

  sections.forEach((section, sectionIndex) => {
    traverseLinks(section.items, [
      `${section.title} [section ${sectionIndex + 1}]`,
    ]);
  });

  return invalid;
}

/**
 * Ensure every actionable bullet includes at least one Jira citation, allowing grouping bullets
 * to omit citations when their children provide them.
 * @param sections - Structured release notes sections to examine.
 * @returns Bullet paths that violate the citation coverage rule.
 */
function findInvalidCitationStructure(
  sections: ReleaseNotesSection[]
): string[] {
  const violations: string[] = [];

  const visitItems = (
    items: ReleaseNotesItem[],
    segments: string[],
    parentHasCitations: boolean
  ): void => {
    items.forEach((item, index) => {
      const currentSegments = [...segments, `item ${index + 1}`];

      const hasCitations = !!item.citations && item.citations.length > 0;
      const isGroupingNode =
        !hasCitations && item.subitems && item.subitems.length > 0;
      const isLeaf = !item.subitems || item.subitems.length === 0;

      if (isLeaf && !hasCitations && !parentHasCitations) {
        violations.push(
          `${currentSegments.join(' › ')} must include at least one Jira citation`
        );
      }

      if (!hasCitations && !isGroupingNode && !isLeaf && !parentHasCitations) {
        violations.push(
          `${currentSegments.join(' › ')} lacks citations and has subitems; either cite the parent or treat it purely as a grouping node`
        );
      }

      const nextParentHasCitations = hasCitations || parentHasCitations;

      if (item.subitems && item.subitems.length > 0) {
        visitItems(
          item.subitems,
          [...currentSegments, 'subitems'],
          nextParentHasCitations
        );
      }
    });
  };

  sections.forEach((section, sectionIndex) => {
    visitItems(
      section.items,
      [`${section.title} [section ${sectionIndex + 1}]`],
      false
    );
  });

  return violations;
}
