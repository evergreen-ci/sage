# Sage Bot Onboarding Guide

This guide walks you through the one-time setup to use Sage Bot.

## Prerequisites

- MongoDB VPN access (required for all API calls)
- A Cursor account with API access
- Access to a supported Jira project (DEVPROD, CLOUDP, AMP, or DOCSP)

## Step 1: Generate a Cursor API Key

1. Go to [cursor.com/settings](https://cursor.com/settings)
2. Navigate to the **API Keys** section
3. Click **Generate new key**
4. Copy and save your API key securely - you won't be able to see it again

## Step 2: Connect Cursor to GitHub

Cursor's cloud agent needs access to your repositories to clone code and push changes. You must install the Cursor GitHub app for any repositories Sage Bot will work on.

### Installation

1. Go to **Integrations** in the [Cursor Dashboard](https://cursor.com/settings)
2. Click **Connect** next to GitHub
3. Choose either **All repositories** or **Selected repositories**

To disconnect later, return to the integrations dashboard and click **Disconnect Account**.

### Repository Not Available?

If a desired repository is not available for selection, you'll need to submit an IT request through [Zendesk](https://help-it.mongodb.com/hc/en-us/requests/new?ticket_form_id=11872020855315) to install Cursor's GitHub app in that repository.

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

## Next Steps

You're all set! Head over to the [usage guide](./usage.md) to learn how to create Jira tickets and trigger Sage Bot.
