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
 * Parse the target repository and optional ref from Jira labels
 * Supports two formats:
 * - repo:<org>/<repo> - repository only
 * - repo:<org>/<repo>@<ref> - repository with inline ref specification
 * @param labels - Array of label strings
 * @returns ParsedRepository object, or null if no repo label found
 * @example
 * parseTargetRepositoryFromLabels(['sage-bot', 'repo:mongodb/mongo-tools'])
 * // Returns: { repository: 'mongodb/mongo-tools', ref: null }
 * @example
 * parseTargetRepositoryFromLabels(['repo:mongodb/mongo-tools@feature-branch'])
 * // Returns: { repository: 'mongodb/mongo-tools', ref: 'feature-branch' }
 */
const parseTargetRepositoryFromLabels = (
  labels: string[]
): ParsedRepository | null => {
  for (const label of labels) {
    const match = label.match(REPO_LABEL_PATTERN);
    if (match) {
      return {
        repository: match[1],
        ref: match[2] || null,
      };
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
  const parsed = parseTargetRepositoryFromLabels(labels);
  return {
    ticketKey: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description,
    assigneeEmail: issue.fields.assignee?.emailAddress || null,
    targetRepository: parsed?.repository ?? null,
    targetRef: parsed?.ref ?? null,
    labels,
  };
};
