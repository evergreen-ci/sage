/**
 * Hardcoded set of project keys that are publicly accessible (visible without authentication).
 * These projects are visible to anonymous users on jira.mongodb.org.
 *
 * To update this list, run: npm run check:public-projects
 * This will compare against the live Jira API and show any differences.
 *
 * Last updated: 2026-03-05
 */
export const PUBLIC_PROJECT_KEYS = new Set([
  'CDRIVER',
  'COMPASS',
  'CSHARP',
  'CXX',
  'DRIVERS',
  'EF',
  'GODRIVER',
  'HIBERNATE',
  'INTELLIJ',
  'INTPYTHON',
  'JAVA',
  'JAVAF',
  'KAFKA',
  'KBSON',
  'MCP',
  'MONGOCRYPT',
  'MONGOID',
  'MONGOSH',
  'MOTOR',
  'NODE',
  'ODATA',
  'PHPC',
  'PHPLIB',
  'PHPORM',
  'PYTHON',
  'RUBY',
  'RUST',
  'SERVER',
  'SPARK',
  'SQL',
  'TOOLS',
  'VS',
  'VSCODE',
  'WT',
]);

/**
 * Checks if a Jira ticket belongs to a publicly accessible project.
 * Public projects are visible without authentication.
 * @param issueKey - The Jira issue key (e.g., "SERVER-12345")
 * @returns true if the ticket's project is publicly accessible, false otherwise
 */
export const isTicketPublic = (issueKey: string): boolean => {
  const projectKey = issueKey.split('-')[0];
  return PUBLIC_PROJECT_KEYS.has(projectKey);
};
