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

/**
 * Format agent launched success panel
 * @param agentUrl - The URL to the Cursor agent session
 * @returns Formatted Jira comment with success panel
 */
export const formatAgentLaunchedPanel = (agentUrl: string): string =>
  formatPanel(
    {
      title: 'Sage Bot Agent Launched',
      borderColor: '#00875A',
      titleBGColor: '#00875A',
      titleColor: '#FFFFFF',
    },
    `A Cursor Cloud Agent has been launched to work on this ticket.\n\n` +
      `*Agent Session:* [View in Cursor|${agentUrl}]\n\n` +
      `The agent will create a pull request when the implementation is complete.`
  );

/**
 * Format agent launch failure panel
 * @param errorMessage - The error message from the launch attempt
 * @returns Formatted Jira comment with error panel
 */
export const formatAgentLaunchFailedPanel = (errorMessage: string): string =>
  formatPanel(
    {
      title: 'Sage Bot Agent Launch Failed',
      borderColor: '#DE350B',
      titleBGColor: '#DE350B',
      titleColor: '#FFFFFF',
    },
    `Failed to launch Cursor Cloud Agent for this ticket.\n\n` +
      `*Error:* ${errorMessage}\n\n` +
      `Please check the configuration and re-add the {{sage-bot}} label to retry.`
  );

/**
 * Format agent completed success panel
 * @param prUrl - The URL to the pull request (optional)
 * @param summary - Summary of the agent's work (optional)
 * @returns Formatted Jira comment with success panel
 */
export const formatAgentCompletedPanel = (
  prUrl?: string,
  summary?: string
): string => {
  let content = `The Cursor Cloud Agent has completed work on this ticket.`;

  if (prUrl) {
    content += `\n\n*Pull Request:* [View PR|${prUrl}]`;
  }

  if (summary) {
    content += `\n\n*Summary:*\n${summary}`;
  }

  return formatPanel(
    {
      title: 'Sage Bot Agent Completed',
      borderColor: '#00875A',
      titleBGColor: '#00875A',
      titleColor: '#FFFFFF',
    },
    content
  );
};

/**
 * Format agent error panel
 * @param errorReason - The reason the agent encountered an error
 * @returns Formatted Jira comment with error panel
 */
export const formatAgentFailedPanel = (errorReason: string): string =>
  formatPanel(
    {
      title: 'Sage Bot Agent Failed',
      borderColor: '#DE350B',
      titleBGColor: '#DE350B',
      titleColor: '#FFFFFF',
    },
    `The Cursor Cloud Agent encountered an error while working on this ticket.\n\n` +
      `*Error:* ${errorReason}\n\n` +
      `You may re-add the {{sage-bot}} label to retry.`
  );

/**
 * Format agent expired panel
 * @returns Formatted Jira comment with warning panel
 */
export const formatAgentExpiredPanel = (): string =>
  formatPanel(
    {
      title: 'Sage Bot Agent Expired',
      borderColor: '#FF8B00',
      titleBGColor: '#FF8B00',
      titleColor: '#FFFFFF',
    },
    `The Cursor Cloud Agent session expired before completing work on this ticket.\n\n` +
      `This can happen if the agent takes too long or encounters issues.\n\n` +
      `You may re-add the {{sage-bot}} label to retry.`
  );

/**
 * Format agent timeout panel for jobs that exceeded the TTL
 * @returns Formatted Jira comment with warning panel
 */
export const formatAgentTimeoutPanel = (): string =>
  formatPanel(
    {
      title: 'Sage Bot Agent Timed Out',
      borderColor: '#FF8B00',
      titleBGColor: '#FF8B00',
      titleColor: '#FFFFFF',
    },
    `The Cursor Cloud Agent did not complete within the expected time limit.\n\n` +
      `The job has been marked as timed out. You may re-add the {{sage-bot}} label to retry.`
  );
