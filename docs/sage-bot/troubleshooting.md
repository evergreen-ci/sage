# Troubleshooting

Common issues and solutions when using Sage Bot.

## Error Messages

### "Assignee does not have credentials configured"

The ticket assignee needs to register their Cursor API key. Go to [Sage Bot Settings](https://spruce.mongodb.com/preferences/sage-bot-settings) to add your API key.

### "Missing repository label"

Add a label in the format `repo:<org>/<repo>` to your ticket. For example: `repo:10gen/mms`.

### "No assignee set"

Assign the ticket to a user who has registered their Cursor API key.

## FAQ

**Q: How long does Sage Bot take to process a ticket?**

A: Processing time varies based on task complexity. Simple tasks may complete in a few minutes, while complex tasks can take longer. Sage Bot posts a comment with the agent session link where you can monitor progress.

**Q: Can I use Sage Bot on any repository?**

A: Yes, Sage Bot works with any GitHub repository that has the [Cursor GitHub app](https://github.com/apps/cursor) installed. Simply add a label in the format `repo:<org>/<repo>` and Sage Bot will use the repository's default branch. If you need a specific branch, use `repo:<org>/<repo>@<branch>`. See the [Cursor GitHub integration docs](https://cursor.com/docs/integrations/github) for more details. If your repository doesn't have the Cursor GitHub app installed, [submit an IT ticket](https://help-it.mongodb.com/hc/en-us/requests/new?ticket_form_id=11872020855315) and select "Let us know more about your request" → Accounts & Access, "Choose the type of issue or access..." → Service Account, "Please select the category of service account you need." → GitHub → App / OAuth Credentials. Then explain that you need the Cursor GitHub app installed on your repository.

**Q: What happens if my API key expires?**

A: You'll need to generate a new key from Cursor and update it in [Sage Bot Settings](https://spruce.mongodb.com/preferences/sage-bot-settings).

**Q: Can multiple people trigger Sage Bot on the same ticket?**

A: Only one active job can run per ticket at a time. If a job is already in progress, adding the label again will be ignored until the current job completes.

**Q: How do I know if my ticket is being processed?**

A: Sage Bot removes the `sage-bot` label immediately when it picks up the ticket and posts a comment with a link to the Cursor agent session.

**Q: Does Sage Bot update the Jira ticket status?**

A: No, Sage Bot only removes the `sage-bot` label and posts comments. Any status transitions depend on your existing Jira automation rules.
