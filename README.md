# Sage - Evergreen AI Service

A TypeScript-based Express.js server powering the Evergreen AI Service.

## Getting Started

### Prerequisites

* Node.js v22 or higher
* Yarn package manager

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
│   │   │   └── parsleyAgent.ts
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
yarn dev:mastra
```

Launches a local Mastra server at `http://localhost:4111` for agent testing.

### Customizing Agents

* **Agents**: Add or update agents in `src/mastra/agents`.
* **Tools**: Place reusable tools in `src/mastra/tools`. Tools are composable functions an agent can call.
* **Workflows**: Add workflows to `src/mastra/workflows`. Workflows define multi-step logic that agents can follow.

All agents and workflows should be registered in `src/mastra/index.ts`.
