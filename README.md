# Sage - Evergreen AI Service

A TypeScript-based Express.js server powering the Evergreen AI Service.

## Getting Started

### Prerequisites

- Node.js v22 or higher
- Yarn package manager
- MongoDB instance installed and running
- Azure OpenAI key

### Environment Variables

Non-secret variables are tracked in `.env.defaults`, with environment-specific variables in `.env.<NODE_ENV>` files.

Update `.env.local` or `.env.<NODE_ENV>.local` files with secrets for external services. These files are ignored by git. Refer to the team password manager or ask a teammate for credentials.

- `REDIS_URL` – required for Jira webhooks; points at the Redis instance that backs the issue queue.
- `JIRA_ISSUE_QUEUE_KEY` – optional key name for the Redis list that stores incoming issue keys (defaults to `queues:jira:issue-keys`).

### Installation

1. Clone the repository or navigate to the project directory.
2. Install dependencies:

   ```bash
   yarn install
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
yarn dev
```

Starts the server using `vite-node`, with hot-reloading and TypeScript support. Default port: `8080` (or set via the `PORT` environment variable).

### Production

```bash
yarn build
yarn start
```

Compiles the TypeScript code and starts the production server using Node.js.

### Clean Build

```bash
yarn clean
```

Removes the `dist/` directory.

---

## Jira Webhooks

- **Endpoint**: `POST /webhooks/jira`
- **Payload**: Any Jira webhook body that includes `issue.key` (or `issueKey` / `issue_key`)
- **Behavior**: Extracts the issue key and pushes it onto the Redis list defined by `JIRA_ISSUE_QUEUE_KEY`. Returns `202 Accepted` when queued, `400` for invalid payloads, and `503` if Redis is unavailable.

Requests must be sent with a `Content-Type: application/json` header. Ensure `REDIS_URL` is configured before enabling production webhooks; otherwise, the server will reject incoming Jira events.

---

## Working with Mastra Agents

The project uses [Mastra](https://mastra.ai/en/docs/overview), a framework for building agentic systems with tools and workflows.

### Running the Mastra Dev Server

```bash
yarn mastra:dev
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
yarn lint
```

### 3. GraphQL Type Generation

We use [`@graphql-codegen`](https://www.graphql-code-generator.com/) to generate
TypeScript types for queries, mutations, and their variables. The generated
types live in `src/gql/generated/types.ts`.

Run the generator after editing or adding GraphQL operations:

```bash
yarn codegen
```

If the schema or your operations change, re-run `yarn codegen` to keep the
types up to date. The command will also run Prettier on the generated file.

### Troubleshooting

- If ESLint or codegen cannot find the schema, verify the `sdlschema` symlink
  path and that the Evergreen repository is on the expected branch.
- If dependencies appear out of date, try `yarn install` or `yarn clean` followed
  by `yarn install` to refresh `node_modules`.

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
   yarn pending-commits
   ```

   For JSON output:

   ```bash
   yarn pending-commits:json
   ```

This will show all commits between what is currently deployed and your local HEAD, including commit hashes, messages, and GitHub URLs.

### Staging

Before pushing to staging, drop a note in 🔒evergreen-ai-devs to make sure no one is using it.

#### Drone

Drone can [promote](https://docs.drone.io/promote/) builds opened on PRs to staging. Before starting, [install and configure the Drone CLI](https://kanopy.corp.mongodb.com/docs/cicd/advanced_drone/#drone-cli).

1. Open a PR with your changes (a draft is okay). This will kick off the `publish` step.
2. Check pending commits using `kcs && yarn pending-commits` to see what will be deployed.
3. Once the build completes, find the build number on [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage).
4. Promote the build to staging:
   - **CLI**: Run `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> staging`
   - **Web UI**: Click `…` > `Promote` on your build's page. Enter "staging" in the "Target" field and submit.

#### Local

Local deploys are slower but useful. First install [Rancher Desktop](https://rancherdesktop.io) as your container manager. Open Rancher and then run `yarn deploy:staging` from Sage to kick off the deploy.

Note that Drone's [deployments page](https://drone.corp.mongodb.com/evergreen-ci/sage/deployments) will not reflect local deploys. To verify your deploy has been pushed, install [Helm](https://kanopy.corp.mongodb.com/docs/configuration/helm/) and run `helm status sage`.

### Production

To deploy to production:

1. Check pending commits: `kcp && yarn pending-commits`
2. Find the build on [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage) for the commit you want to deploy (must be on `main` branch).
3. Promote the build to production:
   - **CLI**: Run `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> production`
   - **Web UI**: Click `…` > `Promote` on your build's page. Enter "production" in the "Target" field and submit.

**Note**: You must be promoting a Drone build that pushed a commit to `main`.
