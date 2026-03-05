import { config } from '@/config';
import { GitHubTokenManager } from './githubTokenManager';

export { GitHubTokenManager } from './githubTokenManager';
export * from './types';

export const githubTokenManager = new GitHubTokenManager({
  appId: config.github.appId,
  privateKey: config.github.privateKey,
  installationIds: {
    '10gen': config.github.installationIds.tenGen,
    'evergreen-ci': config.github.installationIds.evergreenCi,
  },
});
