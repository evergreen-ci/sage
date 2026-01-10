/**
 * Shared constants used across Jira service modules
 */

/** Maximum number of results to fetch in a single Jira search */
export const MAX_SEARCH_RESULTS = 100;

/** Default fields to retrieve when searching Jira issues */
export const DEFAULT_ISSUE_FIELDS = [
  'summary',
  'description',
  'assignee',
  'labels',
];
