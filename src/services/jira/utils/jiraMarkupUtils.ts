/**
 * Jira markup formatting utilities for comments and panels
 * Uses border-only styling for dark mode compatibility
 */

export interface PanelConfig {
  title: string;
  borderColor: string;
  titleBGColor: string;
  titleColor: string;
}

/**
 * Format a Jira panel with title and content
 * @param config - Panel styling configuration
 * @param content - Panel body content
 * @returns Formatted Jira panel markup
 */
export const formatPanel = (config: PanelConfig, content: string): string => {
  const { borderColor, title, titleBGColor, titleColor } = config;
  return (
    `{panel:title=${title}|borderColor=${borderColor}|titleBGColor=${titleBGColor}|titleColor=${titleColor}}\n` +
    `${content}\n` +
    `{panel}`
  );
};

/**
 * Format an error panel for validation failures
 * Uses red color scheme for error state
 * @param errors - Array of error messages
 * @returns Formatted Jira comment with error panel
 */
export const formatValidationErrorPanel = (errors: string[]): string => {
  const errorList = errors.map(e => `* ${e}`).join('\n');
  const content =
    `The following issues must be resolved before sage-bot can process this ticket:\n\n` +
    `${errorList}\n\n` +
    `Please fix these issues and re-add the {{sage-bot}} label to retry.`;

  return formatPanel(
    {
      title: 'Sage Bot Validation Failed',
      borderColor: '#DE350B',
      titleBGColor: '#DE350B',
      titleColor: '#FFFFFF',
    },
    content
  );
};

/**
 * Format a success panel for successful operations
 * Uses green color scheme for success state
 * @param message - Success message content
 * @returns Formatted Jira comment with success panel
 */
export const formatSuccessPanel = (message: string): string =>
  formatPanel(
    {
      title: 'Sage Bot Success',
      borderColor: '#00875A',
      titleBGColor: '#00875A',
      titleColor: '#FFFFFF',
    },
    message
  );

/**
 * Format an info panel for informational messages
 * Uses blue color scheme for info state
 * @param title - Panel title
 * @param message - Info message content
 * @returns Formatted Jira comment with info panel
 */
export const formatInfoPanel = (title: string, message: string): string =>
  formatPanel(
    {
      title,
      borderColor: '#0052CC',
      titleBGColor: '#0052CC',
      titleColor: '#FFFFFF',
    },
    message
  );

/**
 * Format inline code snippet
 * @param code - Code text
 * @returns Formatted inline code
 */
export const inlineCode = (code: string): string => `{{${code}}}`;

/**
 * Format a bullet list
 * @param items - List items
 * @returns Formatted bullet list
 */
export const formatBulletList = (items: string[]): string =>
  items.map(item => `* ${item}`).join('\n');
