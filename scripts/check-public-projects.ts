/**
 * CI script to verify the hardcoded PUBLIC_PROJECT_KEYS list matches
 * the actual public projects from Jira.
 *
 * Usage: npm run check:public-projects
 *
 * This makes an unauthenticated request to the Jira API to get the list
 * of publicly visible projects and compares it against the hardcoded list.
 */

import { PUBLIC_PROJECT_KEYS } from '../src/services/jira/publicProjects';

const JIRA_BASE_URL = 'https://jira.mongodb.org';

async function fetchPublicProjects(): Promise<Set<string>> {
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
  return new Set(projects.map(p => p.key));
}

async function main(): Promise<void> {
  console.log('Fetching public projects from Jira API...\n');

  const liveProjects = await fetchPublicProjects();
  const hardcodedProjects = PUBLIC_PROJECT_KEYS;

  const missingFromHardcoded = [...liveProjects].filter(
    key => !hardcodedProjects.has(key)
  );
  const extraInHardcoded = [...hardcodedProjects].filter(
    key => !liveProjects.has(key)
  );

  console.log(`Live public projects: ${liveProjects.size}`);
  console.log(`Hardcoded projects: ${hardcodedProjects.size}\n`);

  if (missingFromHardcoded.length === 0 && extraInHardcoded.length === 0) {
    console.log('Public projects list is up to date!');
    process.exit(0);
  }

  let hasErrors = false;

  if (missingFromHardcoded.length > 0) {
    console.error('Projects missing from hardcoded list (newly public):');
    missingFromHardcoded.sort().forEach(key => console.error(`  + '${key}',`));
    console.error('');
    hasErrors = true;
  }

  if (extraInHardcoded.length > 0) {
    console.error('Projects in hardcoded list but not publicly visible:');
    extraInHardcoded.sort().forEach(key => console.error(`  - '${key}',`));
    console.error('');
    hasErrors = true;
  }

  if (hasErrors) {
    console.error(
      'Please update PUBLIC_PROJECT_KEYS in src/services/jira/publicProjects.ts'
    );
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
