import {
  extractAllRepoLabels,
  hasLabel,
  parseTargetRepositoryFromLabels,
} from './labelUtils';

describe('labelUtils', () => {
  describe('parseTargetRepositoryFromLabels', () => {
    it('extracts repo from labels', () => {
      const labels = ['sage-bot', 'repo:mongodb/mongo-tools', 'priority'];
      expect(parseTargetRepositoryFromLabels(labels)).toBe(
        'mongodb/mongo-tools'
      );
    });

    it('handles repo label only', () => {
      const labels = ['repo:org/repo-name'];
      expect(parseTargetRepositoryFromLabels(labels)).toBe('org/repo-name');
    });

    it('returns null for empty labels', () => {
      expect(parseTargetRepositoryFromLabels([])).toBeNull();
    });

    it('returns null when no repo label found', () => {
      expect(parseTargetRepositoryFromLabels(['sage-bot', 'bug'])).toBeNull();
    });

    it('handles repos with dots and underscores', () => {
      expect(
        parseTargetRepositoryFromLabels(['repo:my_org/my.repo-name'])
      ).toBe('my_org/my.repo-name');
    });

    it('returns first repo when multiple exist', () => {
      const labels = ['repo:org1/repo1', 'repo:org2/repo2'];
      expect(parseTargetRepositoryFromLabels(labels)).toBe('org1/repo1');
    });
  });

  describe('hasLabel', () => {
    it('returns true when label exists', () => {
      expect(hasLabel(['sage-bot', 'urgent'], 'sage-bot')).toBe(true);
    });

    it('returns false when label does not exist', () => {
      expect(hasLabel(['urgent'], 'sage-bot')).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(hasLabel([], 'sage-bot')).toBe(false);
    });
  });

  describe('extractAllRepoLabels', () => {
    it('extracts multiple repo labels', () => {
      const labels = ['repo:org1/repo1', 'sage-bot', 'repo:org2/repo2'];
      expect(extractAllRepoLabels(labels)).toEqual([
        'org1/repo1',
        'org2/repo2',
      ]);
    });

    it('returns empty array when no repo labels', () => {
      expect(extractAllRepoLabels(['sage-bot', 'urgent'])).toEqual([]);
    });
  });
});
