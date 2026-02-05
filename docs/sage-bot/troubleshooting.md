# Troubleshooting

Common issues and solutions when using Sage Bot.

## Known Issues

These are known limitations we're actively working to resolve.

### PR Titles and Descriptions Not Following Instructions

PR titles and descriptions may not follow conventions specified in your repository's instructions (e.g., `AGENTS.md`, `.cursor/rules`). This is a [known issue with Cursor Cloud Agents](https://forum.cursor.com/t/agent-mostly-ignores-instructions-about-pr-title-description/144792). We are in communication with the Cursor team and they've informed us a fix is coming soon.

**Workaround:** Manually edit PR titles and descriptions if they don't match your conventions.

### Commit Signing

Some repositories (MMS specifically) require all merged commits to be signed. The Cursor cloud agent produces unsigned commits, so engineers will need to sign commits before merging.

**Workaround:** Pull down the branch locally and sign the commits. We provide a [utility script](./scripts/utils/sign_pr_commits.sh) to make this easier:

```bash
./scripts/utils/sign_pr_commits.sh
```

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

**Q: The agent can't compile code, run tests, or install dependencies. How do I fix this?**

A: Your repository likely needs a `.cursor/environment.json` file to configure the cloud agent's environment. This file tells the agent how to set up dependencies, start services, and run commands. See the [optional environment configuration](./onboarding.md#optional-configure-repository-environment) in the onboarding guide.

**Q: The agent produces code that doesn't follow our project conventions or fails CI checks. What should I do?**

A: Configure your repository's environment so the agent can run your formatters, linters, and tests. Add a `.cursor/environment.json` file with your install and build commands. See [Cursor's Cloud Agent Setup documentation](https://cursor.com/docs/cloud-agent#setup) for details.

**Q: The PR title or description doesn't follow our repository's conventions. Why?**

A: See [Known Issues: PR Titles and Descriptions](#pr-titles-and-descriptions-not-following-instructions).
