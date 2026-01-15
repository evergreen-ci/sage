# Sage Bot Onboarding Guide

This guide walks you through the one-time setup to use Sage Bot.

## Prerequisites

- MongoDB VPN access (required for all API calls)
- A Cursor account with API access
- Access to a supported Jira project (DEVPROD, CLOUDP, AMP, or DOCSP)

## Step 1: Get a Cursor API Key

1. Go to the [Cursor Dashboard](https://cursor.com/dashboard?tab=integrations)
2. Navigate to the **API Keys** section
3. Click **Generate new key** (or use an existing key)
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

You can register your Cursor API key either for production use (via API endpoints) or for local testing (via script). Choose the method that fits your needs.

### Option A: Production Setup (API Endpoints)

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

#### Verifying Your Registration

To check if your API key is registered:

```bash
curl https://sage.prod.corp.mongodb.com/pr-bot/user/cursor-key \
  -H "X-Kanopy-Authorization: Bearer $(kanopy-oidc login)"
```

#### Updating or Removing Your Key

To update your key, simply run the POST command again with your new key.

To delete your registered key:

```bash
curl -X DELETE https://sage.prod.corp.mongodb.com/pr-bot/user/cursor-key \
  -H "X-Kanopy-Authorization: Bearer $(kanopy-oidc login)"
```

### Option B: Local Testing Setup

For local development and testing, you can add your API key directly to your local MongoDB collection using the `upsert-api-key.ts` script.

#### Required Environment Variables

Ensure these are set in `.env.local`:

- `MONGODB_URI` - MongoDB connection string (default: `mongodb://localhost:27017`)
- `ENCRYPTION_KEY` - 64-character hex string for AES-256 encryption

The `ENCRYPTION_KEY` must be a 32-byte hex string (64 characters). You can generate one using:

```bash
openssl rand -hex 32
```

A default encryption key is provided in `.env.defaults` for local development only.

#### Adding Your API Key

Use the `upsert-api-key.ts` script to add an encrypted key to your local collection:

```bash
npx tsx scripts/upsert-api-key.ts -e [username]@mongodb.com -k [cursor_api_key]
```

Replace:
- `[username]@mongodb.com` with your MongoDB email address
- `[cursor_api_key]` with your Cursor API key from Step 1

The script will:
1. Connect to your local MongoDB instance
2. Encrypt your API key using the `ENCRYPTION_KEY`
3. Store it in the `user_credentials` collection
4. Display the last 4 characters of the key for verification

#### Testing the Integration

Once your API key is stored locally, you can test the Cursor agent integration by:

1. Starting the Sage server locally:
   ```bash
   yarn dev
   ```

2. Creating a test Jira ticket with the `sage-bot` label (see [Usage Guide](./usage.md))

3. Verifying that the Cursor agent processes the ticket and creates a PR

For more details on local development, see the [README](../../README.md#testing-the-api-locally).

## Next Steps

You're all set! Head over to the [usage guide](./usage.md) to learn how to create Jira tickets and trigger Sage Bot.
