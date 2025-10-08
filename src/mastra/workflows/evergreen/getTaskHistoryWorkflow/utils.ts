enum Requester {
  AdHoc = 'ad_hoc',
  GitHubMergeQueue = 'github_merge_request',
  GitHubPR = 'github_pull_request',
  GitTag = 'git_tag_request',
  Gitter = 'gitter_request',
  Patch = 'patch_request',
  Trigger = 'trigger_request',
}

const mainlineRequesters = [
  Requester.AdHoc,
  Requester.GitTag,
  Requester.Gitter,
  Requester.Trigger,
];

/**
 * Check if a task or version requester is a mainline commit requester
 * @param requester - The requester to check
 * @returns true if the requester is a mainline commit requester, false otherwise
 */
export const isMainlineRequester = (requester: Requester) =>
  mainlineRequesters.includes(requester);

export { Requester };
