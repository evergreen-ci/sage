# Sage Bot Onboarding Guide

Sage Bot automatically generates pull requests from Jira tickets using Cursor's AI agent. This guide explains how to get started.

## Prerequisites

- MongoDB VPN access (required for all API calls)
- A Cursor account with API access
- Access to a [supported Jira project](#supported-projects)

## Step 1: Generate a Cursor API Key

1. Go to [cursor.com/settings](https://cursor.com/settings)
2. Navigate to the **API Keys** section
3. Click **Generate new key**
4. Copy and save your API key securely - you won't be able to see it again

## Step 2: Set Up kanopy-oidc

To authenticate with Sage, you need to install and configure `kanopy-oidc`.

### Install kanopy-oidc

Download the latest release from the [kanopy-oidc releases page](https://github.com/10gen/kanopy-oidc/releases).

### Configure kanopy-oidc

Create a configuration file at `$HOME/.kanopy/config.yaml`:

```yaml
---
domain: corp.mongodb.com
issuer: dex
login:
  connector: oidc
```

### Test Your Setup

Run the following to authenticate:

```bash
kanopy-oidc login
```

This opens your browser for Okta authentication. Once complete, the command outputs your identity token. This token expires after **10 minutes**.

## Step 3: Register Your API Key with Sage

**You must be connected to the MongoDB VPN for this step.**

Use the following curl command to register your Cursor API key:

```bash
curl -X POST https://sage.prod.corp.mongodb.com/pr-bot/user/cursor-key \
  -H "Content-Type: application/json" \
  -H "X-Kanopy-Authorization: Bearer $(kanopy-oidc login)" \
  -d '{"apiKey": "<your-cursor-api-key>"}'
```

Replace `<your-cursor-api-key>` with the API key from Step 1.

A successful response looks like:

```json
{ "success": true, "keyLastFour": "xxxx" }
```

### Verifying Your Registration

To check if your API key is registered:

```bash
curl https://sage.prod.corp.mongodb.com/pr-bot/user/cursor-key \
  -H "X-Kanopy-Authorization: Bearer $(kanopy-oidc login)"
```

### Updating or Removing Your Key

To update your key, simply run the POST command again with your new key.

To delete your registered key:

```bash
curl -X DELETE https://sage.prod.corp.mongodb.com/pr-bot/user/cursor-key \
  -H "X-Kanopy-Authorization: Bearer $(kanopy-oidc login)"
```

## Step 4: Create a Jira Ticket

Your Jira ticket must include the following:

| Field                | Required    | Description                                                         |
| -------------------- | ----------- | ------------------------------------------------------------------- |
| **Summary**          | Yes         | A clear title describing the task                                   |
| **Description**      | Recommended | Detailed implementation requirements                                |
| **Assignee**         | Yes         | Must be set to a user with registered credentials                   |
| **Repository Label** | Yes         | Label in format `repo:<org>/<repo>` or `repo:<org>/<repo>@<branch>` |

### Repository Label Format

The repository label tells Sage Bot which repository to work on:

- `repo:10gen/mms` - Uses the default branch configured for this repo
- `repo:10gen/mms@my-feature-branch` - Uses a specific branch

### Supported Projects

Sage Bot currently monitors the following Jira projects:

- DEVPROD
- CLOUDP
- AMP
- DOCSP

### Pre-configured Repositories

Repositories with default branches are configured in [`src/services/repositories/repositories.yaml`](../../src/services/repositories/repositories.yaml).

If your repository isn't configured, you have two options:

1. **Specify the branch inline** using the `@branch` syntax (e.g., `repo:myorg/myrepo@main`)
2. **Add your repository to the config** by opening a PR to update `repositories.yaml` - contributions are welcome!

Feel free to reach out to the DevProd team if you have questions.

## Step 5: Trigger Sage Bot

To trigger Sage Bot on your ticket:

1. Ensure all required fields are filled in
2. Add the label `sage-bot` to your ticket

Sage Bot will:

1. Detect the label and begin processing
2. Remove the `sage-bot` label automatically
3. Post a comment with the result (success or error details)

## Retrying Failed Jobs

If a job fails, you can retry by simply adding the `sage-bot` label again.

## Troubleshooting

### "Assignee does not have credentials configured"

The ticket assignee needs to register their Cursor API key. See [Step 3](#step-3-register-your-api-key-with-sage).

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

A: Sage Bot removes the `sage-bot` label immediately when it picks up the ticket and posts a comment with the status.
