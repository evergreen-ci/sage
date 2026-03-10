import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PublicProjectsConfig {
  projects: string[];
}

/**
 * Load the public project keys from the YAML configuration file.
 * The YAML file is the source of truth for publicly accessible Jira projects.
 * @returns Set of public project keys
 */
const loadPublicProjectKeys = (): Set<string> => {
  const yamlPath = path.join(__dirname, 'publicProjects.yaml');
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const config = yaml.parse(content) as PublicProjectsConfig;
  return new Set(config.projects);
};

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
