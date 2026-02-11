# Sage Architecture

Sage is an AI agent orchestrator built on the [Mastra framework](https://mastra.ai/). It coordinates multiple specialized agents, tools, and workflows to power DevProd's AI features across the Evergreen ecosystem.

## High-Level Architecture

```
                          ┌─────────────────────────────────────────────┐
                          │              Client Applications            │
                          │                                             │
                          │  Parsley UI    Slack    Jira    Release     │
                          │  (Log Viewer)          (sage-bot) Consumers │
                          └──────┬──────────┬────────┬─────────┬───────┘
                                 │          │        │         │
                                 ▼          ▼        ▼         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Express.js API Server                               │
│                                                                            │
│  Middleware: requestId → userId → sentryContext → httpLogging → cors        │
│                                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────────────┐  │
│  │   /completions│ │ /completions │ │/completions│ │ /completions       │  │
│  │   /parsley/*  │ │ /memento/*   │ │ /lumber/*  │ │ /release-notes/*   │  │
│  │   (SSE stream)│ │              │ │            │ │                    │  │
│  └──────┬───────┘ └──────┬───────┘ └─────┬──────┘ └────────┬──────────┘  │
│         │                │               │                  │             │
│  ┌──────────────────┐  ┌────────────────────────────────────────────┐     │
│  │ /pr-bot/user/*   │  │ /health    /login                         │     │
│  │ (Cursor key CRUD)│  │                                            │     │
│  └──────────────────┘  └────────────────────────────────────────────┘     │
└────────────┬──────────────┬───────────────┬──────────────────┬────────────┘
             │              │               │                  │
             ▼              ▼               ▼                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          Mastra Framework                                  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Agents (Azure OpenAI GPT-4.1)                │   │
│  │                                                                     │   │
│  │  ┌─────────────────────┐   ┌──────────────────────────────────┐    │   │
│  │  │  SageThinkingAgent  │──▶│  QuestionClassifierAgent         │    │   │
│  │  │  (Parsley AI)       │   │  (EVERGREEN|LOG|COMBINATION|     │    │   │
│  │  │  Main orchestrator  │   │   CAN_ANSWER_ON_OWN|IRRELEVANT)  │    │   │
│  │  │                     │──▶│──────────────────────────────────│    │   │
│  │  │                     │   │  EvergreenAgent                  │    │   │
│  │  └─────────────────────┘   │  (GraphQL data fetching)         │    │   │
│  │                             └──────────────────────────────────┘    │   │
│  │  ┌─────────────────────┐   ┌──────────────────────────────────┐    │   │
│  │  │  QuestionOwnership  │   │  SlackThreadSummarizerAgent      │    │   │
│  │  │  Agent (Lumber)     │   │  (Memento)                       │    │   │
│  │  └─────────────────────┘   └──────────────────────────────────┘    │   │
│  │  ┌─────────────────────┐                                           │   │
│  │  │  ReleaseNotesAgent  │                                           │   │
│  │  └─────────────────────┘                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           Workflows                                 │   │
│  │                                                                     │   │
│  │  logCoreAnalyzerWorkflow     releaseNotesWorkflow                  │   │
│  │  (load → chunk → analyze)    (plan → format → generate → validate) │   │
│  │                                                                     │   │
│  │  getLogFileUrlWorkflow                                              │   │
│  │  (resolves log file URLs from task metadata)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                            Tools                                    │   │
│  │                                                                     │   │
│  │  Evergreen GraphQL Tools:   Agent-as-Tool Wrappers:                │   │
│  │    getTask                    askQuestionClassifierAgentTool        │   │
│  │    getTaskFiles               askEvergreenAgentTool                 │   │
│  │    getTaskTests                                                     │   │
│  │    getTaskHistory           Workflow-as-Tool Wrappers:              │   │
│  │    getTaskHistoryById         logCoreAnalyzerTool                   │   │
│  │    getVersion                 resolveLogFileUrlTool                 │   │
│  │    getVersionFromTask                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────────────────┐                                                │
│  │  Mastra Memory         │   Thread-scoped working memory per             │
│  │  (@mastra/mongodb)     │   conversation, stored in MongoDB              │
│  └────────────────────────┘                                                │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     Sage-Bot (Automated PR System)                          │
│                                                                            │
│  ┌────────────────────┐    ┌───────────────────────────┐                   │
│  │ Jira Polling        │──▶│ SageAutoPRBot             │                   │
│  │ Cronjob             │   │ JiraPollingService         │                   │
│  │                     │   │                            │                   │
│  │ Polls for tickets   │   │ 1. Check for duplicates    │                   │
│  │ with "sage-bot"     │   │ 2. Find label initiator    │                   │
│  │ label               │   │ 3. Remove label            │                   │
│  └────────────────────┘   │ 4. Validate ticket          │                   │
│                            │ 5. Launch Cursor agent      │──▶ Cursor Cloud  │
│  ┌────────────────────┐   │ 6. Post results to Jira     │    API            │
│  │ Cursor Status       │   └───────────────────────────┘                   │
│  │ Polling Cronjob     │──▶ Monitors agent execution                       │
│  │                     │   status and updates job runs                      │
│  └────────────────────┘                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

## API Products

Sage exposes five API products, each backed by a dedicated agent or workflow:

| Product           | Route                          | Agent / Workflow           | Description                                                                                          |
| ----------------- | ------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Parsley AI**    | `/completions/parsley/*`       | SageThinkingAgent          | Interactive conversational AI for Evergreen task and log analysis. Streams responses via SSE.        |
| **Memento**       | `/completions/memento/*`       | SlackThreadSummarizerAgent | Converts Slack thread captures into structured Jira-ready summaries (reporter, title, description).  |
| **Lumber**        | `/completions/lumber/*`        | QuestionOwnershipAgent     | Classifies questions and routes them to the appropriate DevProd team.                                |
| **Release Notes** | `/completions/release-notes/*` | releaseNotesWorkflow       | Generates structured, citation-backed release notes from Jira issues.                                |
| **Sage-Bot**      | Cronjob (Jira polling)         | Cursor Remote Agent        | Polls Jira for `sage-bot`-labeled tickets and launches Cursor Cloud Agents to implement them as PRs. |

## SageThinkingAgent (Parsley AI)

The SageThinkingAgent is the central orchestrator for the Parsley AI chat experience. It acts as a senior Evergreen software engineer that reasons about user questions and delegates to specialized sub-agents and workflows.

### Orchestration Flow

```
User Question (via Parsley UI)
    │
    ▼
SageThinkingAgent
    │
    ├──▶ askQuestionClassifierAgentTool
    │        │
    │        ▼
    │    QuestionClassifierAgent
    │        │
    │        ▼
    │    Classification Result:
    │      EVERGREEN ──────▶ askEvergreenAgentTool ──▶ EvergreenAgent ──▶ GraphQL API
    │      LOG ────────────▶ logCoreAnalyzerTool ───▶ logCoreAnalyzerWorkflow
    │      COMBINATION ────▶ Both of the above
    │      CAN_ANSWER_ON_OWN ──▶ Direct answer (no tools)
    │      IRRELEVANT ─────▶ Decline to answer
    │
    ▼
Streamed Response (SSE)
```

### Memory

Each conversation maintains thread-scoped working memory via Mastra Memory backed by MongoDB. The thread ID corresponds to the conversation ID from the client, enabling multi-turn conversations with full context.

## Sage-Bot & Cursor Remote Agents

Sage-Bot is an automated PR generation system that bridges Jira and Cursor Cloud Agents.

### Pipeline

```
Jira Ticket (labeled "sage-bot")
    │
    ▼
Jira Polling Cronjob (scheduled)
    │
    ▼
SageAutoPRBotJiraPollingService
    ├── Check for active duplicate jobs
    ├── Identify who added the label
    ├── Remove the "sage-bot" label
    ├── Create job run record in MongoDB
    ├── Validate ticket:
    │     - Has a repo label (e.g., "repo:mongodb/mongo")
    │     - Has an assignee with a stored Cursor API key
    │
    ▼ (if valid)
Cursor Agent Service
    ├── Build prompt from ticket data (summary, description, key)
    ├── Launch Cursor Cloud Agent via Cursor API
    │     - Clones the target GitHub repository
    │     - Implements the ticket autonomously
    │     - Auto-creates a PR on GitHub
    │
    ▼
Cursor Status Polling Cronjob (scheduled)
    ├── Poll agent execution status
    ├── Update job run record
    └── Post completion/failure comments to Jira
```

### User Credential Management

Users store their Cursor API keys via the `/pr-bot/user/cursor-key` endpoints. Keys are encrypted at rest using AES-256 with a server-side encryption key before being stored in MongoDB.

## Observability

Sage uses a layered observability stack covering tracing, error tracking, eval scoring, and structured logging.

```
┌─────────────────────────────────────────────────────────────┐
│                    Observability Stack                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Honeycomb    │  │  Braintrust   │  │  Sentry           │  │
│  │              │  │              │  │                  │  │
│  │  OpenTelemetry│  │  LLM tracing  │  │  Error tracking   │  │
│  │  distributed  │  │  Eval scoring │  │  Transaction      │  │
│  │  tracing      │  │  Dynamic      │  │  tracing          │  │
│  │              │  │  prompt mgmt  │  │  Console capture   │  │
│  │  Express,     │  │  Experiment   │  │  Unhandled         │  │
│  │  MongoDB,     │  │  reporting    │  │  rejection         │  │
│  │  HTTP spans   │  │              │  │  handling          │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Winston Logger                                       │   │
│  │  Structured JSON logging with request IDs             │   │
│  │  Custom WinstonMastraLogger for framework integration │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Honeycomb (OpenTelemetry)

- **Protocol:** OTLP over HTTP
- **Propagation:** W3C Trace Context
- **Instrumented:** Express routes, MongoDB queries
- **Context:** `AsyncLocalStorageContextManager` for async context propagation

### Braintrust

- **Tracing:** All LLM calls are traced via the `BraintrustExporter` configured in Mastra's observability layer
- **Dynamic Prompts:** Some agents (e.g., QuestionOwnershipAgent) load their system prompts from Braintrust at runtime via `loadPrompt()`, enabling prompt iteration without code deploys
- **Eval Suite:** Comprehensive evaluations for every agent and workflow, producing scores and JUnit XML reports

### Sentry

- **Error Tracking:** Captures unhandled exceptions, rejections, and Express errors
- **Transaction Tracing:** Samples a configurable percentage of requests (default 10%)
- **Console Capture:** Experimental integration captures `console.log/warn/error` as Sentry logs
- **User Context:** Middleware sets the authenticated user on the Sentry scope for each request

## Eval Suite (Braintrust)

Every agent and workflow has a corresponding eval suite that scores outputs against test cases.

| Eval                         | What It Tests                                          |
| ---------------------------- | ------------------------------------------------------ |
| `sageThinkingAgent`          | End-to-end reasoning quality and tool usage            |
| `questionClassifierAgent`    | Classification accuracy across question types          |
| `evergreenAgent`             | Correctness of GraphQL queries and data interpretation |
| `logAnalyzerWorkflow`        | Log analysis completeness and accuracy                 |
| `slackThreadSummarizerAgent` | Summary quality and Jira formatting                    |
| `questionOwnershipAgent`     | Team routing correctness                               |
| `releaseNotesWorkflow`       | Structure, citation validity, and content quality      |

Evals report to the Braintrust project `sage-prod` and generate JUnit XML for CI integration.

## External Services

```
┌─────────────────────────────────────────────────────┐
│                  External Services                    │
│                                                      │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │ Azure OpenAI      │    │ Evergreen GraphQL API │  │
│  │ GPT-4.1           │    │ Task, version, test   │  │
│  │ GPT-4.1-nano      │    │ data queries          │  │
│  └──────────────────┘    └───────────────────────┘  │
│                                                      │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │ Jira REST API     │    │ Cursor Cloud API      │  │
│  │ Ticket polling,   │    │ Launch/monitor remote  │  │
│  │ comments, labels  │    │ coding agents          │  │
│  └──────────────────┘    └───────────────────────┘  │
│                                                      │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │ GitHub            │    │ MongoDB               │  │
│  │ PR creation by    │    │ Conversations, creds, │  │
│  │ Cursor agents     │    │ job runs, memory      │  │
│  └──────────────────┘    └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Data Layer

MongoDB serves as the primary data store with the following collections:

| Collection                | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| **Mastra Memory Threads** | Conversation history and thread metadata for Parsley AI        |
| **User Credentials**      | Encrypted Cursor API keys (AES-256) for sage-bot users         |
| **Job Runs**              | Sage-bot execution records for idempotency and status tracking |

## Key Source Locations

| Component                               | Location                   |
| --------------------------------------- | -------------------------- |
| Application entry point                 | `src/main.ts`              |
| Express server & routes                 | `src/api-server/`          |
| Mastra registration (agents, workflows) | `src/mastra/index.ts`      |
| Agent implementations                   | `src/mastra/agents/`       |
| Tool implementations                    | `src/mastra/tools/`        |
| Workflow implementations                | `src/mastra/workflows/`    |
| Cursor service                          | `src/services/cursor/`     |
| Jira service & polling                  | `src/services/jira/`       |
| Eval suite                              | `src/evals/`               |
| OpenTelemetry setup                     | `src/instrumentation.ts`   |
| Sentry setup                            | `src/sentry-instrument.ts` |
| Config & environment                    | `src/config/index.ts`      |
| Database connection                     | `src/db/connection.ts`     |
