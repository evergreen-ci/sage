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

/**
 * Documentation constants for Sage Bot
 * Base URL for Sage Bot documentation on Pine
 */
export const SAGE_BOT_DOCS_BASE_URL =
  'https://docs.devprod.prod.corp.mongodb.com/sage/sage-bot';

/**
 * Documentation link constants
 * These links point to specific sections of the Sage Bot documentation
 */
export const SAGE_BOT_DOCS_LINKS = {
  /** Link to the usage guide */
  USAGE_GUIDE: `${SAGE_BOT_DOCS_BASE_URL}/usage`,
  /** Link to the repository label format section */
  REPOSITORY_LABEL_FORMAT: `${SAGE_BOT_DOCS_BASE_URL}/usage#repository-label-format`,
  /** Link to the pre-configured repositories section */
  PRE_CONFIGURED_REPOSITORIES: `${SAGE_BOT_DOCS_BASE_URL}/usage#pre-configured-repositories`,
  /** Link to the onboarding guide credentials section */
  ONBOARDING_CREDENTIALS: `${SAGE_BOT_DOCS_BASE_URL}/onboarding#step-4-register-your-api-key-with-sage`,
  /** Link to the troubleshooting guide */
  TROUBLESHOOTING: `${SAGE_BOT_DOCS_BASE_URL}/troubleshooting`,
} as const;
