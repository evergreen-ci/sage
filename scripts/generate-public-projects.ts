/**
 * Script to generate the public projects YAML file from the live Jira API.
 *
 * Usage: pnpm generate:public-projects
 *
 * This makes an unauthenticated request to the Jira API to get the list
 * of publicly visible projects and updates the publicProjects.yaml file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JIRA_BASE_URL = 'https://jira.mongodb.org';
const OUTPUT_FILE = path.join(
  __dirname,
  '../src/services/jira/jiraClient/publicProjects.yaml'
);

async function fetchPublicProjects(): Promise<string[]> {
  const url = `${JIRA_BASE_URL}/rest/api/2/project`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch public projects: ${response.status} ${response.statusText}`
    );
  }

  const projects = (await response.json()) as Array<{ key: string }>;
  return projects.map(p => p.key).sort();
}

function generateYamlContent(projectKeys: string[]): string {
  const projectList = projectKeys.map(key => `  - ${key}`).join('\n');

  return `# Publicly accessible Jira project keys (visible without authentication).
# These projects are visible to anonymous users on jira.mongodb.org.
#
# To update this list, run: pnpm generate:public-projects
projects:
${projectList}
`;
}

async function main(): Promise<void> {
  console.log('Fetching public projects from Jira API...\n');

  const projectKeys = await fetchPublicProjects();

  console.log(`Found ${projectKeys.length} public projects:`);
  projectKeys.forEach(key => console.log(`  - ${key}`));
  console.log('');

  const content = generateYamlContent(projectKeys);
  fs.writeFileSync(OUTPUT_FILE, content);

  console.log(`Updated ${OUTPUT_FILE}`);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
