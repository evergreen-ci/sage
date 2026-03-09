import {
  formatAgentCompletedPanel,
  formatAgentExpiredPanel,
  formatAgentFailedPanel,
  formatAgentLaunchFailedPanel,
  formatAgentTimeoutPanel,
  formatBulletList,
  formatInfoPanel,
  formatPanel,
  formatSuccessPanel,
  formatValidationErrorPanel,
  inlineCode,
} from './jiraMarkupUtils';

describe('jiraMarkupUtils', () => {
  describe('formatPanel', () => {
    it('formats a panel with all config options', () => {
      const result = formatPanel(
        {
          title: 'Test Panel',
          borderColor: '#FF0000',
          titleBGColor: '#00FF00',
          titleColor: '#0000FF',
        },
        'Panel content here'
      );

      expect(result).toContain('{panel:title=Test Panel');
      expect(result).toContain('borderColor=#FF0000');
      expect(result).toContain('titleBGColor=#00FF00');
      expect(result).toContain('titleColor=#0000FF');
      expect(result).toContain('Panel content here');
      expect(result).toContain('{panel}');
    });
  });

  describe('formatValidationErrorPanel', () => {
    it('formats validation errors correctly', () => {
      const errors = ['Error 1', 'Error 2', 'Error 3'];
      const result = formatValidationErrorPanel(errors);

      expect(result).toContain('Sage Bot Validation Failed');
      expect(result).toContain('borderColor=#DE350B');
      expect(result).toContain('* Error 1');
      expect(result).toContain('* Error 2');
      expect(result).toContain('* Error 3');
      expect(result).toContain('{{sage-bot}}');
    });

    it('handles single error', () => {
      const result = formatValidationErrorPanel(['Single error']);
      expect(result).toContain('* Single error');
    });
  });

  describe('formatSuccessPanel', () => {
    it('formats success message with green colors', () => {
      const result = formatSuccessPanel('Operation completed successfully');

      expect(result).toContain('Sage Bot Success');
      expect(result).toContain('borderColor=#00875A');
      expect(result).toContain('Operation completed successfully');
    });
  });

  describe('formatInfoPanel', () => {
    it('formats info message with blue colors and custom title', () => {
      const result = formatInfoPanel('Custom Info', 'Information message');

      expect(result).toContain('Custom Info');
      expect(result).toContain('borderColor=#0052CC');
      expect(result).toContain('Information message');
    });
  });

  describe('inlineCode', () => {
    it('wraps text in inline code markup', () => {
      expect(inlineCode('sage-bot')).toBe('{{sage-bot}}');
      expect(inlineCode('repo:org/repo')).toBe('{{repo:org/repo}}');
    });
  });

  describe('formatBulletList', () => {
    it('formats items as bullet list', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      const result = formatBulletList(items);

      expect(result).toBe('* Item 1\n* Item 2\n* Item 3');
    });

    it('handles empty array', () => {
      expect(formatBulletList([])).toBe('');
    });

    it('handles single item', () => {
      expect(formatBulletList(['Single'])).toBe('* Single');
    });
  });

  describe('formatAgentCompletedPanel', () => {
    it('formats completed panel with PR URL and summary', () => {
      const result = formatAgentCompletedPanel(
        'https://github.com/org/repo/pull/123',
        'Implemented the feature'
      );

      expect(result).toContain('Sage Bot Agent Completed');
      expect(result).toContain('borderColor=#00875A');
      expect(result).toContain(
        '[View PR|https://github.com/org/repo/pull/123]'
      );
      expect(result).toContain('Implemented the feature');
    });

    it('formats completed panel without optional fields', () => {
      const result = formatAgentCompletedPanel();

      expect(result).toContain('Sage Bot Agent Completed');
      expect(result).toContain('has completed work');
      expect(result).not.toContain('View PR');
      expect(result).not.toContain('Summary');
    });
  });

  describe('formatAgentLaunchFailedPanel', () => {
    it('formats generic launch failure with default guidance', () => {
      const result = formatAgentLaunchFailedPanel('Some unexpected error');

      expect(result).toContain('Sage Bot Agent Launch Failed');
      expect(result).toContain('Some unexpected error');
      expect(result).toContain('Please check the configuration');
      expect(result).toContain('troubleshooting');
    });

    it('includes Cursor-side context for default branch resolution error', () => {
      const result = formatAgentLaunchFailedPanel(
        'Failed to determine repository default branch'
      );

      expect(result).toContain('Sage Bot Agent Launch Failed');
      expect(result).toContain(
        'known intermittent issue on Cursor\u0027s side'
      );
      expect(result).toContain('wait a few minutes');
      expect(result).toContain('troubleshooting');
      expect(result).not.toContain('Please check the configuration');
    });

    it('includes Cursor-side context for branch verification error', () => {
      const result = formatAgentLaunchFailedPanel(
        "Failed to verify existence of branch 'master' in repository 10gen/mms"
      );

      expect(result).toContain(
        'known intermittent issue on Cursor\u0027s side'
      );
      expect(result).toContain('wait a few minutes');
    });

    it('matches branch resolution errors case-insensitively', () => {
      const result = formatAgentLaunchFailedPanel(
        'FAILED TO DETERMINE REPOSITORY DEFAULT BRANCH'
      );

      expect(result).toContain(
        'known intermittent issue on Cursor\u0027s side'
      );
    });
  });

  describe('formatAgentFailedPanel', () => {
    it('formats error panel with reason', () => {
      const result = formatAgentFailedPanel('API rate limit exceeded');

      expect(result).toContain('Sage Bot Agent Failed');
      expect(result).toContain('borderColor=#DE350B');
      expect(result).toContain('API rate limit exceeded');
      expect(result).toContain('{{sage-bot}}');
    });
  });

  describe('formatAgentExpiredPanel', () => {
    it('formats expired panel with warning colors', () => {
      const result = formatAgentExpiredPanel();

      expect(result).toContain('Sage Bot Agent Expired');
      expect(result).toContain('borderColor=#FF8B00');
      expect(result).toContain('session expired');
    });
  });

  describe('formatAgentTimeoutPanel', () => {
    it('formats timeout panel with warning colors', () => {
      const result = formatAgentTimeoutPanel();

      expect(result).toContain('Sage Bot Agent Timed Out');
      expect(result).toContain('borderColor=#FF8B00');
      expect(result).toContain('timed out');
    });
  });
});
