# Sage - Evergreen AI Service

Hello World

A TypeScript-based Express.js server powering the Evergreen AI Service.

## Getting Started

### Prerequisites

- Node.js v22 or higher
- pnpm package manager
- MongoDB instance installed and running
- Azure OpenAI key

### Environment Variables

Non-secret variables are tracked in `.env.defaults`, with environment-specific variables in `.env.<NODE_ENV>` files.

Update `.env.local` or `.env.<NODE_ENV>.local` files with secrets for external services. These files are ignored by git. Refer to the team password manager or ask a teammate for credentials.

#### Encryption Key

The `ENCRYPTION_KEY` environment variable is required for encrypting sensitive data (e.g., user API keys) stored in MongoDB. It must be a 32-byte hex string (64 characters) for AES-256 encryption.

**Generating a new key:**

```bash
openssl rand -hex 32
```

**Storage:** In deployed environments, the encryption key is stored in Kanopy secrets. A default key is provided in `.env.defaults` for local development.

### Installation

1. Clone the repository or navigate to the project directory.
2. Install dependencies:

   ```bash
   pnpm install
   ```

---

## Project Structure

```
sage/
├── src/
│   ├── api-server/
│   │   ├── index.ts                  # API server setup
│   │   ├── middlewares/             # Express middlewares
│   │   │   ├── index.ts
│   │   │   └── logging.ts
│   │   ├── routes/                  # HTTP route handlers
│   │   │   ├── completions/
│   │   │   │   ├── index.ts
│   │   │   │   └── parsley.ts
│   │   │   ├── health.ts
│   │   │   ├── index.ts
│   │   │   └── root.ts
│   │   └── types/
│   │       └── index.ts
│   ├── config/
│   │   └── index.ts                  # Environment config
│   ├── db/
│   │   └── connection.ts             # MongoDB connection
│   ├── mastra/                       # Mastra agent framework
│   │   ├── agents/
│   │   │   └── evergreenAgent.ts
│   │   ├── tools/
│   │   │   └── some_tool.ts          # [Tools documentation](https://mastra.ai/en/docs/tools-mcp/overview)
│   │   ├── workflows/
│   │   │   └── some_workflow.ts      # [Workflows documentation](https://mastra.ai/en/docs/workflows/overview)
│   │   ├── models/
│   │   │   └── openAI/
│   │   │       ├── baseModel.ts
│   │   │       └── gpt41.ts
│   │   └── index.ts                  # Mastra setup/exports
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger/
│   │   │   ├── index.ts
│   │   │   ├── setup.ts
│   │   │   ├── winstonMastraLogger.ts
│   │   │   └── logger.test.ts
│   │   └── index.ts
│   ├── __tests__/                    # Unit and integration tests
│   └── main.ts                       # App entry point
├── environments/
│   └── staging.yaml                  # Deployment configuration
├── scripts/                          # Project automation scripts
├── .drone.yml                        # Drone CI pipeline
├── .evergreen.yml                    # Evergreen configuration
├── .env.defaults                     # Shared environment variables
├── .env.<NODE_ENV>                   # Non-secret environment variables
└── README.md
```

---

## Running the Server

### Development

```bash
pnpm dev
```

Starts the server using `vite-node`, with hot-reloading and TypeScript support. Default port: `8080` (or set via the `PORT` environment variable).

### Production

```bash
pnpm build
pnpm start
```

Compiles the TypeScript code and starts the production server using Node.js.

### Clean Build

```bash
pnpm clean
```

Removes the `dist/` directory.

---

## Testing the API Locally

Most API endpoints require authentication via the `x-kanopy-internal-authorization` header. For local development, there are two ways to authenticate requests:

### Configuring Cursor API Key for Local Testing

To test the Cursor agent integration locally, you'll need to:

1. **Get a Cursor API Key**: Obtain an API key from the [Cursor Dashboard](https://cursor.com/dashboard?tab=integrations). Navigate to the **API Keys** section and generate a new key.

2. **Add the Key via REST Endpoints**: Use the local API endpoints to store your key:
   - `POST /pr-bot/user/cursor-key` - Create or update your Cursor API key
   - `GET /pr-bot/user/cursor-key` - Check if a key is registered
   - `DELETE /pr-bot/user/cursor-key` - Remove your stored key

   Example:

   ```bash
   curl -X POST http://localhost:8080/pr-bot/user/cursor-key \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-cursor-api-key"}'
   ```

### Option 1: Set the `USER_NAME` Environment Variable (Recommended)

When the `USER_NAME` environment variable is set, the authentication middleware uses it as the user ID, bypassing JWT validation. Add it to your `.env.local`:

```bash
USER_NAME=your.email@mongodb.com
```

Then test endpoints with simple curl commands:

```bash
curl -X POST http://localhost:8080/pr-bot/user/cursor-key \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key-here"}'
```

### Option 2: Use a Fake JWT Header

If `USER_NAME` is not set, you can pass a JWT in the `x-kanopy-internal-authorization` header. The middleware only decodes the payload (doesn't verify the signature), so you can construct a test JWT:

```bash
# JWT payload: {"sub":"test@example.com"}
curl -X POST http://localhost:8080/pr-bot/user/cursor-key \
  -H "Content-Type: application/json" \
  -H "x-kanopy-internal-authorization: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.fake" \
  -d '{"apiKey": "your-api-key-here"}'
```

To create a custom test JWT, base64-encode your desired payload:

```bash
echo -n '{"sub":"your.email@mongodb.com"}' | base64
# Use the output as the middle segment: header.PAYLOAD.signature
```

---

## Docker Builds

- Docker contexts now respect `.dockerignore`, so local `docker build` and `docker buildx` commands skip large directories such as `node_modules/`, `coverage/`, and generated GraphQL schemas. If you need to reference a file that is ignored by default, build with `--no-cache` or temporarily remove the entry.

- The Drone `publish` step uses Kaniko layer caching backed by ECR. Subsequent CI builds reuse previously published layers automatically, so rebuilds after small changes are significantly faster.

### Reusing CI cache locally

You can opt into the same cache when iterating locally with BuildKit:

1. Authenticate against the Sage ECR registry (example):

   ```bash
   aws ecr get-login-password --region us-east-1 \
     | docker login --username AWS --password-stdin 795250896452.dkr.ecr.us-east-1.amazonaws.com
   ```

2. Run `docker buildx build` with the cache image that Drone maintains:

   ```bash
   docker buildx build \
     --platform linux/arm64 \
     --cache-from type=registry,ref=795250896452.dkr.ecr.us-east-1.amazonaws.com/devprod-evergreen/${DRONE_REPO_NAME}-cache \
     --cache-to type=registry,ref=795250896452.dkr.ecr.us-east-1.amazonaws.com/devprod-evergreen/${DRONE_REPO_NAME}-cache,mode=max \
     -t sage:local .
   ```

Replace `${DRONE_REPO_NAME}` with your repository name if you are building from a fork (Sage uses `sage`). The `-t sage:local` tag is just a local image label—name it however you like. The `--cache-to` flag updates the shared cache so that your next build—and CI—can reuse the warmed layers.

---

## Working with Mastra Agents

The project uses [Mastra](https://mastra.ai/en/docs/overview), a framework for building agentic systems with tools and workflows.

### Environment Symlinks

Mastra's dev server and build process use `dotenv-flow` from `src/mastra/public/` to resolve environment variables. Before running Mastra commands, create the required symlinks:

```bash
pnpm mastra:symlink-env
```

This symlinks all `.env*` files from the project root into `src/mastra/public/`. The symlinks are git-ignored and only need to be created once per clone.

### Running the Mastra Dev Server

```bash
pnpm mastra:dev
```

Launches a local Mastra server at `http://localhost:4111` for agent testing.

### Customizing Agents

- **Agents**: Add or update agents in `src/mastra/agents`.
- **Tools**: Place reusable tools in `src/mastra/tools`. Tools are composable functions an agent can call.
- **Workflows**: Add workflows to `src/mastra/workflows`. Workflows define multi-step logic that agents can follow.

All agents and workflows should be registered in `src/mastra/index.ts`.

---

## GraphQL Setup

Sage relies on Evergreen’s GraphQL schema for both query linting and type
generation. To keep the schema in sync with Evergreen, create a local symlink
to the [Evergreen repository’s `graphql/schema`](https://github.com/evergreen-ci/evergreen/tree/master/graphql/schema) directory.

### 1. Symlink the GraphQL schema

Run the following command **from the root of the Sage repository**, replacing
`<path_to_evergreen_repo>` with the absolute path to your local Evergreen
checkout:

```bash
ln -s <path_to_evergreen_repo>/graphql/schema sdlschema
```

This creates a folder-level symlink named `sdlschema/` that Sage’s ESLint and
GraphQL Code Generator will pick up automatically.

### 2. GraphQL Query Linting

With the schema symlinked, ESLint will validate your `.ts`, `.gql`, and
`.graphql` files against the Evergreen schema during development. You can run a
manual lint pass at any time with:

```bash
pnpm lint
```

### 3. GraphQL Type Generation

We use [`@graphql-codegen`](https://www.graphql-code-generator.com/) to generate
TypeScript types for queries, mutations, and their variables. The generated
types live in `src/gql/generated/types.ts`.

Run the generator after editing or adding GraphQL operations:

```bash
pnpm codegen
```

If the schema or your operations change, re-run `pnpm codegen` to keep the
types up to date. The command will also run Prettier on the generated file.

### Troubleshooting

- If ESLint or codegen cannot find the schema, verify the `sdlschema` symlink
  path and that the Evergreen repository is on the expected branch.
- If dependencies appear out of date, try `pnpm install` or `pnpm clean` followed
  by `pnpm install` to refresh `node_modules`.

## Evals

We use **evals** to measure model performance through the [Braintrust platform](https://www.braintrust.dev/docs/start/eval-sdk).

For detailed information about running evals, managing datasets, scoring, and reporting, see the [Evals documentation](src/evals/README.md).

## Deployment

### Checking Pending Commits

Before deploying, you can check which commits are pending deployment to an environment:

1. Switch to the appropriate kubectl context:
   - **Production**: Run `kcp` (switches to production context)
   - **Staging**: Run `kcs` (switches to staging context)

2. Check pending commits:

   ```bash
   pnpm pending-commits
   ```

   For JSON output:

   ```bash
   pnpm pending-commits:json
   ```

This will show all commits between what is currently deployed and your local HEAD, including commit hashes, messages, and GitHub URLs.

### Staging

Before pushing to staging, drop a note in 🔒evergreen-ai-devs to make sure no one is using it.

#### Drone

Drone can [promote](https://docs.drone.io/promote/) builds opened on PRs to staging. Before starting, [install and configure the Drone CLI](https://kanopy.corp.mongodb.com/docs/cicd/advanced_drone/#drone-cli).

1. Open a PR with your changes (a draft is okay). This will kick off the `publish` step.
2. Check pending commits using `kcs && pnpm pending-commits` to see what will be deployed.
3. Once the build completes, find the build number on [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage).
4. Promote the build to staging:
   - **CLI**: Run `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> staging`
   - **Web UI**: Click `…` > `Promote` on your build's page. Enter "staging" in the "Target" field and submit.

#### Local

Local deploys are slower but useful. First install [Rancher Desktop](https://rancherdesktop.io) as your container manager. Open Rancher and then run `pnpm deploy:staging` from Sage to kick off the deploy.

Note that Drone's [deployments page](https://drone.corp.mongodb.com/evergreen-ci/sage/deployments) will not reflect local deploys. To verify your deploy has been pushed, install [Helm](https://kanopy.corp.mongodb.com/docs/configuration/helm/) and run `helm status sage`.

### Production

To deploy to production:

1. Check pending commits: `kcp && pnpm pending-commits`
2. Find the build on [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage) for the commit you want to deploy (must be on `main` branch).
3. Promote the build to production:
   - **CLI**: Run `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> production`
   - **Web UI**: Click `…` > `Promote` on your build's page. Enter "production" in the "Target" field and submit.

**Note**: You must be promoting a Drone build that pushed a commit to `main`.

### Manual Cronjob Execution

In the staging environment, the following cronjobs are disabled from automatic execution to prevent interference with local testing:

- `sage-bot-jira-polling-job` - Polls Jira for new tickets to process
- `cursor-agent-status-polling-job` - Polls Cursor for agent status updates

These cronjobs can still be manually executed using `kubectl` for testing purposes.

#### Prerequisites

1. Ensure you have `kubectl` installed and configured
2. Switch to the staging Kubernetes context:
   ```bash
   kcs  # or manually: kubectl config use-context <staging-context>
   ```

All commands below use the `-n devprod-evergreen` flag to specify the namespace. This avoids persisting namespace changes in your kubeconfig.

#### Manually Executing a Cronjob

To manually trigger a cronjob, use `kubectl create job` to create a one-time job from the cronjob:

```bash
# Execute sage-bot-jira-polling-job
kubectl create job --from=cronjob/sage-bot-jira-polling-job sage-bot-jira-polling-job-manual-$(date +%s) -n devprod-evergreen

# Execute cursor-agent-status-polling-job
kubectl create job --from=cronjob/cursor-agent-status-polling-job cursor-agent-status-polling-job-manual-$(date +%s) -n devprod-evergreen
```

The `$(date +%s)` suffix ensures each manual execution has a unique job name.

#### Monitoring Job Execution

To check the status of a manually created job:

```bash
# List recent jobs
kubectl get jobs -n devprod-evergreen

# View job details
kubectl describe job <job-name> -n devprod-evergreen

# View job logs
kubectl logs job/<job-name> -n devprod-evergreen
```

#### Cleaning Up Manual Jobs

After testing, you can delete a specific manual job:

```bash
kubectl delete job <job-name> -n devprod-evergreen
```

Or delete all manual jobs for a specific cronjob:

```bash
# Delete all manual jobs for sage-bot-jira-polling-job
kubectl get jobs -o name -n devprod-evergreen | grep '^job.batch/sage-bot-jira-polling-job-manual-' | xargs kubectl delete -n devprod-evergreen

# Delete all manual jobs for cursor-agent-status-polling-job
kubectl get jobs -o name -n devprod-evergreen | grep '^job.batch/cursor-agent-status-polling-job-manual-' | xargs kubectl delete -n devprod-evergreen
```
