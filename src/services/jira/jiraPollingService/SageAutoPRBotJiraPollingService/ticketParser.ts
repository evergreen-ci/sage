import { JiraIssue, ParsedTicketData } from '@/services/jira/types';
import { REPO_LABEL_PATTERN } from './constants';

/**
 * Parse the target repository from Jira labels
 * Expects format: repo:<org_name>/<repo_name>
 * @param labels - Array of label strings
 * @returns The repository string in format org/repo, or null if not found
 * @example
 * parseTargetRepositoryFromLabels(['sage-bot', 'repo:mongodb/mongo-tools'])
 * // Returns: 'mongodb/mongo-tools'
 */
const parseTargetRepositoryFromLabels = (labels: string[]): string | null => {
  for (const label of labels) {
    const match = label.match(REPO_LABEL_PATTERN);
    if (match) {
      return match[1];
    }
  }
  return null;
};

/**
 * Extract required data from a Jira issue
 * @param issue - The Jira issue to extract data from
 * @returns Parsed ticket data
 */
export const extractTicketData = (issue: JiraIssue): ParsedTicketData => {
  const labels = issue.fields.labels || [];
  return {
    ticketKey: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description,
    assigneeEmail: issue.fields.assignee?.emailAddress || null,
    targetRepository: parseTargetRepositoryFromLabels(labels),
    labels,
  };
};
