import { isTicketPublic, PUBLIC_PROJECT_KEYS } from './publicProjects';

describe('publicProjects', () => {
  describe('PUBLIC_PROJECT_KEYS', () => {
    it('contains expected public projects', () => {
      // Spot check some known public projects
      expect(PUBLIC_PROJECT_KEYS.has('SERVER')).toBe(true);
      expect(PUBLIC_PROJECT_KEYS.has('COMPASS')).toBe(true);
      expect(PUBLIC_PROJECT_KEYS.has('NODE')).toBe(true);
      expect(PUBLIC_PROJECT_KEYS.has('PYTHON')).toBe(true);
    });

    it('does not contain private projects', () => {
      // These should not be in the public list
      expect(PUBLIC_PROJECT_KEYS.has('DEVPROD')).toBe(false);
      expect(PUBLIC_PROJECT_KEYS.has('PRIVATE')).toBe(false);
    });
  });

  describe('isTicketPublic', () => {
    it('returns true for tickets in public projects', () => {
      expect(isTicketPublic('SERVER-12345')).toBe(true);
      expect(isTicketPublic('SERVER-1')).toBe(true);
      expect(isTicketPublic('COMPASS-999')).toBe(true);
      expect(isTicketPublic('NODE-123')).toBe(true);
    });

    it('returns false for tickets in private projects', () => {
      expect(isTicketPublic('DEVPROD-123')).toBe(false);
      expect(isTicketPublic('PRIVATE-999')).toBe(false);
      expect(isTicketPublic('INTERNAL-456')).toBe(false);
    });

    it('extracts project key correctly from issue key', () => {
      // The project key is everything before the first hyphen
      expect(isTicketPublic('SERVER-12345')).toBe(true);
      expect(isTicketPublic('WT-1')).toBe(true);
    });
  });
});
