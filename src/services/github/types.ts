export type GitHubOrganization = '10gen' | 'evergreen-ci';

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationIds: Record<GitHubOrganization, string>;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  repository: string;
}
