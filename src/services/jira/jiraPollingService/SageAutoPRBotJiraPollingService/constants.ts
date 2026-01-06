/** Label name used to trigger sage-bot processing */
export const SAGE_BOT_LABEL = 'sage-bot';

/**
 * Regex pattern for repo label format: repo:<org>/<repo> or repo:<org>/<repo>@<ref>
 * Group 1: org/repo
 * Group 2: optional ref (without the @)
 */
export const REPO_LABEL_PATTERN =
  /^repo:([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)(?:@([a-zA-Z0-9_.\-/]+))?$/;
