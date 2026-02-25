import { JiraIssue, ParsedTicketData } from '@/services/jira/types';
import { REPO_LABEL_PATTERN } from './constants';

/**
 * Parsed repository information from a label
 */
interface ParsedRepository {
  /** The repository in org/repo format */
  repository: string;
  /** Optional branch/ref specified after @ */
  ref: string | null;
}

/**
 * Parse all target repositories and optional refs from Jira labels
 * Supports two formats:
 * - repo:<org>/<repo> - repository only
 * - repo:<org>/<repo>@<ref> - repository with inline ref specification
 * @param labels - Array of label strings
 * @returns Array of ParsedRepository objects for each matching label
 * @example
 * parseAllRepositoriesFromLabels(['sage-bot', 'repo:mongodb/mongo-tools'])
 * // Returns: [{ repository: 'mongodb/mongo-tools', ref: null }]
 * @example
 * parseAllRepositoriesFromLabels(['repo:mongodb/repo1', 'repo:mongodb/repo2@main'])
 * // Returns: [{ repository: 'mongodb/repo1', ref: null }, { repository: 'mongodb/repo2', ref: 'main' }]
 */
const parseAllRepositoriesFromLabels = (
  labels: string[]
): ParsedRepository[] => {
  const repositories: ParsedRepository[] = [];
  for (const label of labels) {
    const match = label.match(REPO_LABEL_PATTERN);
    if (match) {
      repositories.push({
        repository: match[1],
        ref: match[2] || null,
      });
    }
  }
  return repositories;
};

/**
 * Extract required data from a Jira issue
 * @param issue - The Jira issue to extract data from
 * @returns Parsed ticket data
 */
export const extractTicketData = (issue: JiraIssue): ParsedTicketData => {
  const labels = issue.fields.labels || [];
  const allRepos = parseAllRepositoriesFromLabels(labels);
  const firstRepo = allRepos[0] || null;
  return {
    ticketKey: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description,
    assigneeEmail: issue.fields.assignee?.emailAddress || null,
    targetRepository: firstRepo?.repository ?? null,
    targetRef: firstRepo?.ref ?? null,
    targetRepositories: allRepos,
    labels,
  };
};
