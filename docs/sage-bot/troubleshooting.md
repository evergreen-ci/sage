# Troubleshooting

Common issues and solutions when using Sage Bot.

## Error Messages

### "Assignee does not have credentials configured"

The ticket assignee needs to register their Cursor API key. See the [onboarding guide](./onboarding.md#step-4-register-your-api-key-with-sage).

### "Missing repository label"

Add a label in the format `repo:<org>/<repo>` to your ticket. For example: `repo:10gen/mms`.

### "Repository is not configured"

Either:

1. Add your repository to the Sage configuration (contact the DevProd team), or
2. Specify the branch inline: `repo:<org>/<repo>@<branch>`

### "No assignee set"

Assign the ticket to a user who has registered their Cursor API key.

### Curl command returns connection error

Ensure you are connected to the MongoDB VPN.

## FAQ

**Q: How long does Sage Bot take to process a ticket?**

A: Processing time varies based on task complexity. Simple tasks may complete in a few minutes, while complex tasks can take longer. Sage Bot posts a comment with the agent session link where you can monitor progress.

**Q: Can I use Sage Bot on any repository?**

A: Currently, Sage Bot supports repositories that are either pre-configured or where you specify the branch inline. The repository must be accessible to the Cursor agent.

**Q: What happens if my API key expires?**

A: You'll need to generate a new key from Cursor and register it again using the POST endpoint.

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

A: This is a [known issue with Cursor Cloud Agents](https://forum.cursor.com/t/agent-mostly-ignores-instructions-about-pr-title-description/144792) where PR title and description rules from repository instructions are not always respected. We are in contact with the Cursor team about enforcing repository directions for PR titles and descriptions. In the meantime, you may need to manually edit the PR title and description to match your conventions.
