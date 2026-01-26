import {
  clearConfigCache,
  getDefaultBranch,
  isRepositoryConfigured,
  loadRepositoriesConfig,
} from './repositoryConfig';

describe('repositoryConfig', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  describe('loadRepositoriesConfig', () => {
    it('loads and parses the repositories.yaml file', () => {
      const config = loadRepositoriesConfig();

      expect(config.repositories).toBeDefined();
      expect(Object.keys(config.repositories).length).toBeGreaterThan(0);
    });

    it('caches the config on subsequent calls', () => {
      const first = loadRepositoriesConfig();
      const second = loadRepositoriesConfig();

      expect(first).toBe(second);
    });
  });

  describe('getDefaultBranch', () => {
    it('returns the default branch for a configured repository', () => {
      expect(getDefaultBranch('evergreen-ci/sage')).toBe('main');
      expect(getDefaultBranch('10gen/mms')).toBe('master');
    });

    it('returns null for an unconfigured repository', () => {
      expect(getDefaultBranch('unknown/repo')).toBeNull();
    });
  });

  describe('isRepositoryConfigured', () => {
    it('returns true for configured repositories', () => {
      expect(isRepositoryConfigured('evergreen-ci/sage')).toBe(true);
    });

    it('returns false for unconfigured repositories', () => {
      expect(isRepositoryConfigured('unknown/repo')).toBe(false);
    });
  });
});
