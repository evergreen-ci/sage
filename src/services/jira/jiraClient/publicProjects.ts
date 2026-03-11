import { PUBLIC_PROJECT_KEYS } from '@/generated/public-projects';

// Re-export from generated file
export { PUBLIC_PROJECT_KEYS };

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
