/**
 * Shared constants used across Jira service modules
 */

/** Label name used to trigger sage-bot processing */
export const SAGE_BOT_LABEL = 'sage-bot';

/** Regex pattern for repo label format: repo:<org>/<repo> */
export const REPO_LABEL_PATTERN = /^repo:([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)$/;

/** Maximum number of results to fetch in a single Jira search */
export const MAX_SEARCH_RESULTS = 100;

/** Default fields to retrieve when searching Jira issues */
export const DEFAULT_ISSUE_FIELDS = [
  'summary',
  'description',
  'assignee',
  'labels',
];
