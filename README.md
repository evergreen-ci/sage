# Sage - Evergreen AI Service

A TypeScript-based Express.js server powering the Evergreen AI Service.

## Getting Started

### Prerequisites

* Node.js v22 or higher
* Yarn package manager
* MongoDB instance installed and running
* Azure OpenAI key

### Environment Variables

Copy the `env-example` file to `.env` and update the values to match your environment.

```bash
cp env-example .env
```

Copy the `env.example.local` file to `.env.<deployment-environment>.local` and update the values to match your environment. You should do this for all remote environments you plan to run against.
```bash
cp .env.example.local .env.<deployment-environment>.local
```

### Installation

1. Clone the repository or navigate to the project directory.
2. Install dependencies:

   ```bash
   yarn install
   ```
3. Set up environment variables:

   ```bash
   cp env-example .env
   ```

   Update the `.env` file with the necessary values. Refer to the team password manager or ask a teammate for credentials.

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
├── env-example                       # Environment variable template
└── README.md
```

---

## Running the Server

### Development

```bash
yarn dev
```

Starts the server using `ts-node-dev`, with hot-reloading and TypeScript support. Default port: `3000` (or set via the `PORT` environment variable).

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

## Working with Mastra Agents

The project uses [Mastra](https://mastra.ai/en/docs/overview), a framework for building agentic systems with tools and workflows.

### Running the Mastra Dev Server

```bash
yarn mastra:dev
```

Launches a local Mastra server at `http://localhost:4111` for agent testing.

### Customizing Agents

* **Agents**: Add or update agents in `src/mastra/agents`.
* **Tools**: Place reusable tools in `src/mastra/tools`. Tools are composable functions an agent can call.
* **Workflows**: Add workflows to `src/mastra/workflows`. Workflows define multi-step logic that agents can follow.

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

• If ESLint or codegen cannot find the schema, verify the `sdlschema` symlink
  path and that the Evergreen repository is on the expected branch.  
- If ESLint or codegen cannot find the schema, verify the `sdlschema` symlink
  path and that the Evergreen repository is on the expected branch.  
- If dependencies appear out of date, try `yarn install` or `yarn clean` followed
  by `yarn install` to refresh `node_modules`.
  
## Deployment

### Staging Deploys

To deploy your changes to Sage's staging environment, make changes on a new branch. Update the .drone.yml's `trigger` field to include your branch name, commit, and push up to GitHub. A Drone build will be kicked off automatically.
