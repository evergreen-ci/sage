import { REPO_LABEL_PATTERN } from '../constants';

/**
 * Parse the target repository from Jira labels
 * Expects format: repo:<org_name>/<repo_name>
 * @param labels - Array of label strings
 * @returns The repository string in format org/repo, or null if not found
 * @example
 * parseTargetRepositoryFromLabels(['sage-bot', 'repo:mongodb/mongo-tools'])
 * // Returns: 'mongodb/mongo-tools'
 */
export const parseTargetRepositoryFromLabels = (
  labels: string[]
): string | null => {
  for (const label of labels) {
    const match = label.match(REPO_LABEL_PATTERN);
    if (match) {
      return match[1];
    }
  }
  return null;
};

/**
 * Check if a label array contains a specific label
 * @param labels - Array of label strings
 * @param targetLabel - The label to search for
 * @returns True if the label exists
 */
export const hasLabel = (labels: string[], targetLabel: string): boolean =>
  labels.includes(targetLabel);

/**
 * Extract all repo labels from a label array
 * @param labels - Array of label strings
 * @returns Array of repository strings in format org/repo
 */
export const extractAllRepoLabels = (labels: string[]): string[] =>
  labels
    .map(label => {
      const match = label.match(REPO_LABEL_PATTERN);
      return match ? match[1] : null;
    })
    .filter((repo): repo is string => repo !== null);
