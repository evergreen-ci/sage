# GitHub PR Merge Status Polling

The PR merge status polling service checks whether PRs created by Sage agents have been merged, declined, or abandoned. It runs as a cron job every 5 minutes via `pollJiraTicketStatusJob.ts`.

## Production Setup

### 1. GitHub App Credentials

The service authenticates as a GitHub App. You need four environment variables:

| Variable | Description | Where to find it |
|----------|-------------|-----------------|
| `GITHUB_APP_ID` | The GitHub App's numeric ID | GitHub App settings page → "About" section |
| `GITHUB_PRIVATE_KEY` | PEM-format private key | GitHub App settings → "Private keys" → Generate |
| `GITHUB_INSTALLATION_ID_10GEN` | Installation ID for the `10gen` org | See below |
| `GITHUB_INSTALLATION_ID_EVERGREEN_CI` | Installation ID for the `evergreen-ci` org | See below |

**Finding installation IDs:**

1. Go to your GitHub App's settings page
2. Click "Install App" in the sidebar
3. Click the gear icon next to each org's installation
4. The installation ID is the number in the URL: `github.com/organizations/{org}/settings/installations/{ID}`

**Private key format:**

The PEM key should use `\n` for newlines in the env var:

```
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

### 2. Supported Repositories

The GitHub App must be installed on the target organizations with **Pull Request read** access. Currently supported orgs:

- `10gen` — mms, mongo, fern, dsi, mongot, sls, signal-processing-service, baas
- `evergreen-ci` — ui, evergreen, sage

PRs from orgs without a configured installation ID will fail with `"No Octokit instance found for organization"`.

### 3. Adding New Organizations

To support a new GitHub org:

1. Install the GitHub App on the org
2. Add the installation ID env var (e.g. `GITHUB_INSTALLATION_ID_MONGODB`)
3. Update `src/config/index.ts` — add to the `Config` interface and `config` object
4. Update `src/services/github/types.ts` — add to the `GitHubOrganization` union type
5. Update `src/services/github/githubTokenManager.ts` — add to the `organizations` array
6. Update `src/services/github/index.ts` — map the config key to the org name

## Local Testing

### Prerequisites

Create a `.env.production.local` (or `.env.development.local`) with:

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>
GITHUB_APP_ID=<app-id>
GITHUB_PRIVATE_KEY="<pem-key-with-escaped-newlines>"
GITHUB_INSTALLATION_ID_10GEN=<id>
GITHUB_INSTALLATION_ID_EVERGREEN_CI=<id>
```

### Running the debug script

```bash
NODE_ENV=production npx dotenv-flow -- npx vite-node src/services/cursor/jobs/debugPrMergeStatusPolling.ts
```

This connects to the database, finds one completed job with an open PR, checks its merge status via the GitHub API, and updates the database if the status changed.

### Running the full polling job

```bash
NODE_ENV=production npx dotenv-flow -- npx vite-node src/services/cursor/jobs/pollJiraTicketStatusJob.ts
```

This processes all completed jobs with open PRs sequentially.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `No Octokit instance found for organization: X` | Missing installation ID for that org | Add `GITHUB_INSTALLATION_ID_X` env var |
| `Authentication failed` | Invalid app ID or private key | Verify credentials, check PEM key formatting |
| `PR not found` (404) | PR was deleted or repo access revoked | Job is skipped gracefully |
| Config validation failure on startup | Required env vars missing | Set all `GITHUB_*` vars listed above |
