import { Version2Client } from 'jira.js';
import { config } from '@/config';
import logger from '@/utils/logger';
import {
  COMMENT_VISIBILITY_ROLE,
  DEFAULT_ISSUE_FIELDS,
  MAX_SEARCH_RESULTS,
} from '../constants';
import { JiraIssue, JiraIssueFields } from '../types';

/**
 * JiraClient provides methods for interacting with the Jira REST API
 * Uses jira.js library with PAT (Personal Access Token) authentication
 * PAT is passed as an OAuth2 bearer token
 */
class JiraClient {
  private client: Version2Client;

  constructor() {
    this.client = new Version2Client({
      host: config.sageBot.jiraBaseUrl,
      authentication: {
        // PAT is used as a bearer token via oauth2 config
        oauth2: {
          accessToken: config.sageBot.jiraApiToken,
        },
      },
    });
  }

  /**
   * Search for issues using JQL
   * @param jql - The JQL query string
   * @param fields - Fields to retrieve for each issue
   * @returns Array of Jira issues matching the query
   */
  searchIssues = async (
    jql: string,
    fields: string[] = DEFAULT_ISSUE_FIELDS
  ): Promise<JiraIssue[]> => {
    // Note: searchForIssuesUsingJqlPost is deprecated, but we must use it for Jira Server/Data Center compatibility.
    // The newer "Enhanced" endpoint is Jira Cloud-only and returns 404 on Server, so we cannot use it.
    // Despite its deprecation, this endpoint is still necessary for us to support both Server and Data Center.
    const response = await this.client.issueSearch.searchForIssuesUsingJqlPost({
      jql,
      fields,
      maxResults: MAX_SEARCH_RESULTS,
    });

    return (response.issues || []).map(issue => ({
      key: issue.key!,
      fields: issue.fields as unknown as JiraIssueFields,
    }));
  };

  /**
   * Remove a label from an issue
   * @param issueKey - The Jira issue key
   * @param labelToRemove - The label to remove from the issue
   */
  removeLabel = async (
    issueKey: string,
    labelToRemove: string
  ): Promise<void> => {
    await this.client.issues.editIssue({
      issueIdOrKey: issueKey,
      update: {
        labels: [{ remove: labelToRemove }],
      },
    });

    logger.info(`Removed label '${labelToRemove}' from issue ${issueKey}`);
  };

  /**
   * Add a comment to an issue.
   * Comments are restricted to the project role defined by COMMENT_VISIBILITY_ROLE
   * to prevent unintended exposure of internal information on public projects.
   * @param issueKey - The Jira issue key
   * @param commentText - The comment text to add
   */
  addComment = async (issueKey: string, commentText: string): Promise<void> => {
    await this.client.issueComments.addComment({
      issueIdOrKey: issueKey,
      comment: commentText,
      visibility: {
        type: 'role',
        value: COMMENT_VISIBILITY_ROLE,
      },
    });

    logger.info(`Added comment to issue ${issueKey}`);
  };

  /**
   * Find who added a specific label to an issue
   *
   * Note: Uses getIssue with expand=changelog instead of the dedicated changelog endpoint
   * because the /changelog endpoint is Jira Cloud-only and returns 404 on Server/Data Center
   * @param issueKey - The Jira issue key
   * @param labelName - The label name to search for
   * @returns The email of the user who most recently added the label, or null if not found
   */
  findLabelAddedBy = async (
    issueKey: string,
    labelName: string
  ): Promise<string | null> => {
    try {
      const issue = await this.client.issues.getIssue({
        issueIdOrKey: issueKey,
        expand: 'changelog',
        fields: [], // Don't need field data, just changelog
      });

      // Search through changelog entries (most recent first)
      for (const entry of issue.changelog?.histories || []) {
        for (const item of entry.items || []) {
          // Look for label field changes where the label was added
          if (
            item.field === 'labels' &&
            typeof item.to === 'string' &&
            item.to.includes(labelName) &&
            (typeof item.from !== 'string' || !item.from.includes(labelName))
          ) {
            return entry.author?.emailAddress || null;
          }
        }
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to get changelog for ${issueKey}`, error);
      return null;
    }
  };
}

const jiraClient = new JiraClient();

export { jiraClient, JiraClient };
