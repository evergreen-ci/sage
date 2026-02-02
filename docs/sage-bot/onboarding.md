# Sage Bot Onboarding Guide

This guide walks you through the one-time setup to use Sage Bot.
Sage Bot uses [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent) to make pull requests to Github repos based on Jira tickets.

You must provide Sage Bot with a Cursor API Key tied to your Cursor account.
Sage Bot uses the API key to make requests with the Cursor Agent on your behalf.

## Prerequisites

- MongoDB VPN access (required for all API calls)
- A Cursor account with API access
- Access to a supported Jira project:
  - DEVPROD
  - CLOUDP
  - AMP
  - DOCSP
- Github repository with Cursor's Github App installed

### Repository Does Not Have Cursor Github App Installed?

If a desired repository is not available for selection, you'll need to submit an IT request through [Zendesk](https://help-it.mongodb.com/hc/en-us/requests/new?ticket_form_id=11872020855315) to install Cursor's GitHub app in that repository.

## Step 1: Generate a Cursor API Key

1. Go to [Cursor Integration settings](https://cursor.com/dashboard?tab=integrations)
2. Navigate to the **User API Keys** section
3. Click **New User API key**
4. Copy and save your API key securely - you won't be able to see it again

## Step 2: Connect Cursor to GitHub

Cursor's cloud agent needs access to your repositories to clone code and push changes. You must install the Cursor GitHub app for any repositories Sage Bot will work on.

### Installation

1. Go to **Integrations** in the [Cursor Dashboard](https://cursor.com/settings)
2. Click **Connect** next to GitHub
3. Choose either **All repositories** or **Selected repositories**

To disconnect later, return to the integrations dashboard and click **Disconnect Account**.

### Permissions

The Cursor GitHub app requires these permissions for cloud agent functionality:

| Permission            | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| Repository access     | Clone your code and create working branches      |
| Pull requests         | Create PRs with agent changes for your review    |
| Issues                | Track bugs and tasks that agents discover or fix |
| Checks and statuses   | Report on code quality and test results          |
| Actions and workflows | Monitor CI/CD pipelines and deployment status    |

For more details, see [Cursor's GitHub integration documentation](https://cursor.com/docs/integrations/github).

## Step 3: Set Up kanopy-oidc

To authenticate with Sage, you need `kanopy-oidc`. Follow the [official installation and configuration instructions](https://github.com/kanopy-platform/kanopy-oidc/?tab=readme-ov-file#installation).

## Step 4: Register Your API Key with Sage

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

## Optional: Configure Repository Environment

For better results with Sage Bot, your repository can include a `.cursor/environment.json` file that configures the cloud agent environment. This ensures the agent can properly compile code, run formatters, and execute tests.

### Why Configure an Environment?

When Sage Bot runs, it uses Cursor's cloud agent which operates in an isolated Ubuntu-based VM. Without proper configuration, the agent may:

- Fail to install dependencies
- Be unable to compile or build the project
- Skip running tests or formatters
- Produce code that doesn't follow project conventions

### Setting Up environment.json

See [Cursor's Cloud Agent Setup documentation](https://cursor.com/docs/cloud-agent#setup) for instructions on configuring your repository's environment.

## Next Steps

You're all set! Head over to the [usage guide](./usage.md) to learn how to create Jira tickets and trigger Sage Bot.
