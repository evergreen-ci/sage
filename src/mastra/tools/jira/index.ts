import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { jiraClient } from '@/services/jira/jiraClient';
import { jiraIssueSchema } from '@/services/jira/schemas';

const searchJiraIssuesInputSchema = z.object({
  jql: z
    .string()
    .describe(
      'JQL (Jira Query Language) query to search for issues. The DevProd project key is DEVPROD. IMPORTANT: Do not use currentUser() in JQL — the API authenticates as a service account. To query for the current user, use their userId from the request context as their email (e.g. assignee = "firstname.lastname@mongodb.com"). Examples: \'project = DEVPROD AND status = "In Progress"\', \'key = DEVPROD-1234\', \'assignee = "mohamed.khelif@mongodb.com" AND resolution = Unresolved\''
    ),
  fields: z
    .array(z.string())
    .optional()
    .describe(
      'Optional list of fields to retrieve. Defaults to summary, description, assignee, and labels if not specified'
    ),
});

const searchJiraIssuesOutputSchema = z.object({
  success: z.boolean(),
  issues: z.array(jiraIssueSchema).optional(),
  error: z.string().optional(),
});

export const searchJiraIssuesTool = createTool({
  id: 'searchJiraIssuesTool',
  description:
    'Searches for Jira issues using JQL (Jira Query Language). Returns matching issues with their key, summary, description, assignee, and labels. Use JQL syntax to filter by project, status, assignee, labels, or any other Jira field.',
  inputSchema: searchJiraIssuesInputSchema,
  outputSchema: searchJiraIssuesOutputSchema,
  execute: async inputData => {
    try {
      const issues = await jiraClient.searchIssues(
        inputData.jql,
        inputData.fields
      );

      return {
        success: true,
        issues,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to search Jira issues';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
