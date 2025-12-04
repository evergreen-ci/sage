# Sage - Evergreen AI Service

Within these pages resides the TypeScript-driven Express.js engine that animates Evergreen's artifices. Though the incantations below are faithful, they are recounted in the ceremonious diction favored by our guild.

## Getting Started

### Prerequisites

Before attempting any conjuration, be certain the following implements are at the ready:

- Node.js v22 or a more contemporary release
- Yarn, lest npm muddle the lockfiles
- A MongoDB daemon already awakened
- An Azure OpenAI key retrieved from the sanctioned vault

### Environment Variables

Common, non-secret variables dwell in `.env.defaults`, while each environment (`development`, `test`, `production`, and their kin) maintains its own `.env.<NODE_ENV>` scroll. Secrets belong in `.env.local` or `.env.<NODE_ENV>.local`, which git dutifully ignores. Consult the password manager—or a trusted compatriot—before altering these runes.

### Installation

1. Clone this repository, or otherwise step into the directory wherein it resides.
2. Invite all dependencies to manifest:

   ```bash
   yarn install
   ```

---

## Project Structure

Should your bearings falter, contemplate the cartography below:

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

Invoke the dev server with a single utterance:

```bash
yarn dev
```

This command coaxes `vite-node` into service, providing hot reloading and TypeScript enlightenment. The server ordinarily listens on port `8080`, unless the `PORT` variable decrees otherwise.

### Production

When the time for sober deployment arrives, follow the two-beat liturgy:

```bash
yarn build
yarn start
```

The first stanza compiles TypeScript into JavaScript fit for Node.js, and the second awakens the compiled artifact.

### Clean Build

Should detritus accumulate in `dist/`, sweep it away thus:

```bash
yarn clean
```

---

## Working with Mastra Agents

Sage leans heavily upon [Mastra](https://mastra.ai/en/docs/overview), the framework for agents, tools, and workflows. Treat it with the reverence due any capricious spirit.

### Running the Mastra Dev Server

```bash
yarn mastra:dev
```

A local Mastra enclave will manifest at `http://localhost:4111`, permitting you to interrogate agents in safety.

### Customizing Agents

- **Agents** dwell in `src/mastra/agents`; add or revise them there.
- **Tools** belong to `src/mastra/tools`, so that common functions may be summoned repeatedly.
- **Workflows** inhabit `src/mastra/workflows`, weaving multi-step stratagems.

Remember to enlist every new agent or workflow inside `src/mastra/index.ts`, lest it languish unused.

---

## GraphQL Setup

Sage defers to Evergreen's GraphQL schema both for linting supplications and type generation. Keep the schema synchronized through the ancient art of the symlink.

### 1. Symlink the GraphQL Schema

From the root of this repository, fashion a link named `sdlschema/`, adjusting `<path_to_evergreen_repo>` to match your local Evergreen checkout:

```bash
ln -s <path_to_evergreen_repo>/graphql/schema sdlschema
```

Henceforth, ESLint and the GraphQL code generator shall regard the linkage as gospel.

### 2. GraphQL Query Linting

Once the schema is bound, ESLint scrutinizes `.ts`, `.gql`, and `.graphql` files during development. To beckon a manual audit:

```bash
yarn lint
```

### 3. GraphQL Type Generation

The [`@graphql-codegen`](https://www.graphql-code-generator.com/) tool breathes TypeScript types into `src/gql/generated/types.ts`. Re-run it whenever queries mutate:

```bash
yarn codegen
```

Should the schema or operations shift, repeat the command to renew the generated types; Prettier will polish the result.

### Troubleshooting

- If ESLint or codegen cannot perceive the schema, confirm that `sdlschema` points to an Evergreen checkout on the expected branch.
- If dependencies appear anachronistic, consider `yarn install`, or `yarn clean` followed by `yarn install`, to restore order.

## Evals

Model performance is adjudicated through **evals** on the [Braintrust platform](https://www.braintrust.dev/docs/start/eval-sdk). Consult `src/evals/README.md` for rituals concerning dataset curation, scoring, and reporting.

## Deployment

### Checking Pending Commits

Prior to any deployment, divine which commits await their turn:

1. Assume the correct `kubectl` persona:
   - **Production**: `kcp`
   - **Staging**: `kcs`
2. Petition the repository for pending commits:

   ```bash
   yarn pending-commits
   ```

   For JSON-laden omens:

   ```bash
   yarn pending-commits:json
   ```

The output recites every commit between the deployed revision and `HEAD`, along with hashes, messages, and GitHub links.

### Staging

Alert the denizens of 🔒evergreen-ai-devs before disturbing staging.

#### Drone

Drone may [promote](https://docs.drone.io/promote/) any PR build toward staging once the `publish` step completes:

1. Open (even as draft) a PR; this triggers the build.
2. With `kcs && yarn pending-commits`, observe what shall deploy.
3. Retrieve the build number from [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage).
4. Promote the build:
   - **CLI**: `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> staging`
   - **Web UI**: choose `…` → `Promote`, type `staging`, and submit.

#### Local

For local deployments—slower, yet occasionally necessary—install [Rancher Desktop](https://rancherdesktop.io), open it, and then run `yarn deploy:staging`. Drone's [deployments ledger](https://drone.corp.mongodb.com/evergreen-ci/sage/deployments) ignores such efforts; confirm success with [Helm](https://kanopy.corp.mongodb.com/docs/configuration/helm/) via `helm status sage`.

### Production

1. Inspect pending commits with `kcp && yarn pending-commits`.
2. Locate on [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage) the build corresponding to the desired commit on `main`.
3. Promote that build:
   - **CLI**: `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> production`
   - **Web UI**: `…` → `Promote`, specify `production`, and proceed.

**Note**: Only builds already published from `main` may tread into production.
