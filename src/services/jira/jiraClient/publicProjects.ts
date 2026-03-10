// YAML is parsed at build time by vite-plugin-yaml
import publicProjectsConfig from './publicProjects.yaml';

/**
 * Load the public project keys from the YAML configuration.
 * The YAML is parsed at build time by vite-plugin-yaml.
 * @returns Set of public project keys
 */
const loadPublicProjectKeys = (): Set<string> =>
  new Set(publicProjectsConfig.projects);

/**
 * Set of project keys that are publicly accessible (visible without authentication).
 * These projects are visible to anonymous users on jira.mongodb.org.
 *
 * To update this list, run: pnpm generate:public-projects
 */
export const PUBLIC_PROJECT_KEYS = loadPublicProjectKeys();

/**
 * Checks if a Jira ticket belongs to a publicly accessible project.
 * Public projects are visible without authentication.
 * @param issueKey - The Jira issue key (e.g., "SERVER-12345")
 * @returns true if the ticket's project is publicly accessible, false otherwise
 */
export const isTicketPublic = (issueKey: string): boolean => {
  const projectKey = issueKey.split('-')[0].trim().toUpperCase();
  return PUBLIC_PROJECT_KEYS.has(projectKey);
};
