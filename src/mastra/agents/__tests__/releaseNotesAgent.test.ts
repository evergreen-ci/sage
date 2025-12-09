import { describe, expect, it } from 'vitest';
import {
  buildReleaseNotesSectionPlans,
  normalizeReleaseNotesOutput,
  releaseNotesInputSchema,
  releaseNotesOutputSchema,
} from '@/mastra/agents/releaseNotesAgent';
import opsManagerSample from '@/mastra/tests/data/release-notes-input-ops-manager-8.0.16.json';

const baseInput = {
  product: 'test-product',
};

describe('buildReleaseNotesSectionPlans', () => {
  it('groups issues into the correct sections and flags vulnerability grouping', () => {
    const input = releaseNotesInputSchema.parse({
      ...baseInput,
      jiraIssues: [
        {
          key: 'IMP-1',
          issueType: 'IMPROVEMENT',
          summary: 'Adds a new dashboard widget',
        },
        {
          key: 'BUG-7',
          issueType: 'BUG',
          summary: 'Fixes flaky replica set validation',
        },
        {
          key: 'SEC-42',
          issueType: 'VULNERABILITY',
          summary: 'Addresses CVE-2024-1234',
        },
      ],
    });

    const planner = buildReleaseNotesSectionPlans(input);

    expect(planner.sections.map(plan => plan.title)).toEqual([
      'Improvements',
      'Bug Fixes',
    ]);
    expect(planner.issues.map(issue => issue.key)).toEqual([
      'IMP-1',
      'BUG-7',
      'SEC-42',
    ]);
    expect(planner.hasSecurityIssues).toBe(true);
  });

  it('prefers curated copy when available and retains additional metadata', () => {
    const input = releaseNotesInputSchema.parse({
      ...baseInput,
      jiraIssues: [
        {
          key: 'IMP-2',
          issueType: 'IMPROVEMENT',
          summary: 'Surface connection usage metrics',
          description: 'Exposes a card with connection usage over time.',
          additionalMetadata: {
            release_notes:
              'Adds a card that charts daily connection usage for quick capacity checks.',
            customer_impact:
              'Improves visibility into connection saturation issues.',
            team_owner: 'Observability',
            '  custom_field  ': '  value  ',
          },
          pullRequests: [
            {
              title: 'IMP-2: metrics card',
              description: '  Adds UI and supporting API  ',
            },
          ],
        },
      ],
    });

    const planner = buildReleaseNotesSectionPlans(input);
    const issue = planner.issues.find(candidate => candidate.key === 'IMP-2');
    expect(issue).toBeDefined();
    expect(issue?.curatedCopy).toBe(
      'Adds a card that charts daily connection usage for quick capacity checks.'
    );
    expect(issue?.metadata).toEqual({
      customer_impact: 'Improves visibility into connection saturation issues.',
      team_owner: 'Observability',
      custom_field: 'value',
    });
    expect(issue?.description).toBe(
      'Exposes a card with connection usage over time.'
    );
    expect(issue?.pullRequests[0]).toEqual({
      title: 'IMP-2: metrics card',
      description: 'Adds UI and supporting API',
    });
  });

  it('omits metadata when only curated fields are present', () => {
    const input = releaseNotesInputSchema.parse({
      ...baseInput,
      jiraIssues: [
        {
          key: 'BUG-9',
          issueType: 'BUG',
          summary: 'Fixes deadlock in task scheduler',
          additionalMetadata: {
            release_notes:
              'Resolves a deadlock preventing the scheduler from issuing new tasks.',
          },
        },
      ],
    });

    const planner = buildReleaseNotesSectionPlans(input);
    const issue = planner.issues.find(candidate => candidate.key === 'BUG-9');

    expect(issue).toBeDefined();
    expect(issue?.metadata).toBeUndefined();
    expect(issue?.curatedCopy).toBe(
      'Resolves a deadlock preventing the scheduler from issuing new tasks.'
    );
  });

  it('respects custom section configuration order and grouping', () => {
    const input = releaseNotesInputSchema.parse({
      product: 'test-product',
      sections: ['Highlights', 'Security', 'Stability'],
      jiraIssues: [
        {
          key: 'IMP-5',
          issueType: 'IMPROVEMENT',
          summary: 'Adds real-time metrics widgets',
        },
        {
          key: 'TASK-12',
          issueType: 'Task',
          summary: 'Backfills metadata required by the new widgets',
        },
        {
          key: 'SEC-77',
          issueType: 'VULNERABILITY',
          summary: 'Mitigates CVE-2024-7777',
        },
        {
          key: 'BUG-21',
          issueType: 'BUG',
          summary: 'Fixes intermittent auth failures',
        },
      ],
    });

    const planner = buildReleaseNotesSectionPlans(input);

    expect(planner.sections.map(plan => plan.title)).toEqual([
      'Highlights',
      'Security',
      'Stability',
    ]);
    expect(planner.issues.map(issue => issue.key)).toEqual([
      'IMP-5',
      'TASK-12',
      'SEC-77',
      'BUG-21',
    ]);
    expect(planner.hasSecurityIssues).toBe(true);
  });

  it('handles larger ops manager sample input without losing sections', () => {
    const input = releaseNotesInputSchema.parse(opsManagerSample);

    const planner = buildReleaseNotesSectionPlans(input);

    expect(planner.sections.length).toBeGreaterThan(0);
    expect(planner.issues.length).toBe(input.jiraIssues.length);
  });
});

describe('normalizeReleaseNotesOutput', () => {
  it('repairs common schema deviations', () => {
    const raw = {
      sections: [
        {
          title: '  Improvements ',
          items: [
            {
              summary: 'Adds a new metrics dashboard for ops teams.',
              citations: 'DEVPROD-1, DEVPROD-2',
              links: [
                {
                  label: 'Metrics Dashboard',
                  href: 'https://example.com/docs',
                },
                { text: '', url: '' },
              ],
              subitems: [
                {
                  text: 'Follow-on task to expand datasets.',
                  citations: ['DEVPROD-2', ''],
                },
                {
                  text: '  ',
                },
              ],
            },
            {
              text: '   ',
              citations: ['DEVPROD-3'],
            },
          ],
        },
        {
          name: 'Bug Fixes',
          entries: [
            {
              title: 'Resolves crash when parsing configs.',
              citation: 'DEVPROD-9',
              links: { text: 'Crash Fix', url: 'https://example.com/fix' },
            },
          ],
        },
      ],
    };

    const repaired = normalizeReleaseNotesOutput(raw);
    expect(repaired).toBeDefined();

    const validation = releaseNotesOutputSchema.safeParse(repaired);
    expect(validation.success).toBe(true);

    if (!validation.success) {
      return;
    }

    const [improvements, bugFixes] = validation.data.sections;

    expect(improvements.title).toBe('Improvements');
    expect(improvements.items).toHaveLength(1);
    expect(improvements.items[0].citations).toEqual(['DEVPROD-1', 'DEVPROD-2']);
    expect(improvements.items[0].links).toEqual([
      { text: 'Metrics Dashboard', url: 'https://example.com/docs' },
    ]);
    expect(improvements.items[0].subitems).toHaveLength(1);

    expect(bugFixes.title).toBe('Bug Fixes');
    expect(bugFixes.items).toHaveLength(1);
    expect(bugFixes.items[0].citations).toEqual(['DEVPROD-9']);
  });

  it('extracts sections from keyed object structures', () => {
    const raw = {
      sections: {
        Improvements: [
          {
            text: 'Supports automatic sharding.',
            issues: ['DEVPROD-10'],
          },
        ],
        'Bug Fixes': [
          {
            text: 'Fixes rollout regression.',
            issues: 'DEVPROD-11',
          },
        ],
      },
    };

    const repaired = normalizeReleaseNotesOutput(raw);
    expect(repaired).toBeDefined();

    const validation = releaseNotesOutputSchema.safeParse(repaired);
    expect(validation.success).toBe(true);

    if (!validation.success) {
      return;
    }

    expect(validation.data.sections).toHaveLength(2);
    expect(validation.data.sections[0].items[0].citations).toEqual([
      'DEVPROD-10',
    ]);
    expect(validation.data.sections[1].items[0].citations).toEqual([
      'DEVPROD-11',
    ]);
  });
});
