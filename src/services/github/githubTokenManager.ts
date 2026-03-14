import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';
import logger from '@/utils/logger';
import { GitHubAppConfig, GitHubOrganization, PullRequestInfo } from './types';

export class GitHubTokenManager {
  private octokitInstances: Map<GitHubOrganization, Octokit>;
  private config: GitHubAppConfig;

  constructor(config: GitHubAppConfig) {
    this.config = config;
    this.octokitInstances = new Map();
    this.initializeOctokitInstances();
  }

  private initializeOctokitInstances = (): void => {
    const privateKey = this.config.privateKey.replace(/\\n/g, '\n');

    const organizations: GitHubOrganization[] = [
      '10gen',
      'evergreen-ci',
    ];

    for (const org of organizations) {
      const installationId = this.config.installationIds[org];

      if (!installationId) {
        logger.warn(`No installation ID configured for organization: ${org}`);
        continue;
      }

      try {
        const octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: this.config.appId,
            privateKey,
            installationId,
          },
        });

        this.octokitInstances.set(org, octokit);
        logger.debug(`Initialized Octokit for organization: ${org}`);
      } catch (error) {
        logger.error(`Failed to initialize Octokit for ${org}`, { error });
      }
    }
  };

  getOctokit = (organization: GitHubOrganization): Octokit => {
    const octokit = this.octokitInstances.get(organization);

    if (!octokit) {
      throw new Error(
        `No Octokit instance found for organization: ${organization}. ` +
          `Available organizations: ${Array.from(this.octokitInstances.keys()).join(', ')}`
      );
    }

    return octokit;
  };

  getOctokitByRepo = (repo: string): Octokit => {
    const owner = repo.split('/')[0];

    if (!owner) {
      throw new Error(`Invalid repository format: ${repo}. Expected "owner/repo"`);
    }

    return this.getOctokit(owner as GitHubOrganization);
  };

  getPullRequest = async (
    repo: string,
    prNumber: number
  ): Promise<PullRequestInfo | null> => {
    const [owner, repoName] = repo.split('/');

    if (!owner || !repoName) {
      throw new Error(`Invalid repository format: ${repo}. Expected "owner/repo"`);
    }

    const octokit = this.getOctokitByRepo(repo);

    try {
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber,
      });

      return {
        number: pr.number,
        title: pr.title,
        state: pr.state as 'open' | 'closed',
        merged: pr.merged ?? false,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        url: pr.html_url,
        repository: repo,
      };
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as any).status === 404) {
        logger.warn(`PR not found: ${repo}#${prNumber}`);
        return null;
      }
      logger.error(`Failed to fetch PR ${prNumber} from ${repo}`, { error });
      throw error;
    }
  };

  getPullRequestByUrl = async (prUrl: string): Promise<PullRequestInfo | null> => {
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

    if (!match) {
      throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
    }

    const [, owner, repo, prNumber] = match;
    const fullRepo = `${owner}/${repo}`;

    return this.getPullRequest(fullRepo, parseInt(prNumber, 10));
  };

  checkPullRequestMerged = async (prUrl: string): Promise<boolean> => {
    const prInfo = await this.getPullRequestByUrl(prUrl);
    return prInfo?.merged ?? false;
  };
}

