# Sage Architecture

Sage is an AI agent orchestrator built on the [Mastra framework](https://mastra.ai/). It coordinates multiple specialized agents, tools, and workflows to power DevProd's AI features across the Evergreen ecosystem.

## High-Level Architecture

```mermaid
graph TB
    subgraph Clients["Client Applications"]
        ParsleyUI["Parsley UI\n(Log Viewer)"]
        Slack["Slack"]
        JiraUI["Jira\n(sage-bot label)"]
        RelConsumers["Release Notes\nConsumers"]
        DevProdTeams["DevProd Teams"]
    end

    subgraph API["Express.js API Server"]
        MW["Middleware\nrequestId → userId → sentryContext → httpLogging → cors"]
        ParsleyRoute["/completions/parsley/*\n(SSE stream)"]
        MementoRoute["/completions/memento/*"]
        LumberRoute["/completions/lumber/*"]
        ReleaseRoute["/completions/release-notes/*"]
        UserRoute["/pr-bot/user/*\n(Cursor key CRUD)"]
        HealthRoute["/health  /login"]
    end

    subgraph Mastra["Mastra Framework"]
        subgraph Agents["Agents (Azure OpenAI GPT-4.1)"]
            SageThinking["SageThinkingAgent\n(Parsley AI)\nMain Orchestrator"]
            QClassifier["QuestionClassifierAgent"]
            Evergreen["EvergreenAgent\n(GraphQL data fetching)"]
            QOwnership["QuestionOwnershipAgent\n(Lumber)"]
            SlackSum["SlackThreadSummarizerAgent\n(Memento)"]
            RNAgent["ReleaseNotesAgent"]
        end

        subgraph Workflows["Workflows"]
            LogWF["logCoreAnalyzerWorkflow\nload → chunk → analyze"]
            RNWF["releaseNotesWorkflow\nplan → format → generate → validate"]
            LogUrlWF["getLogFileUrlWorkflow"]
        end

        subgraph Tools["Tools"]
            EGTools["Evergreen GraphQL Tools\ngetTask, getTaskFiles,\ngetTaskTests, getTaskHistory,\ngetVersion, getVersionFromTask"]
            AgentAsTools["Agent-as-Tool Wrappers\naskQuestionClassifierAgentTool\naskEvergreenAgentTool"]
            WFAsTools["Workflow-as-Tool Wrappers\nlogCoreAnalyzerTool\nresolveLogFileUrlTool"]
        end

        Memory["Mastra Memory\n(@mastra/mongodb)\nThread-scoped working memory"]
    end

    subgraph SageBot["Sage-Bot (Automated PR System)"]
        JiraPoll["Jira Polling Cronjob"]
        AutoPR["SageAutoPRBot\nJiraPollingService"]
        CursorSvc["Cursor Agent Service"]
        CursorPoll["Cursor Status\nPolling Cronjob"]
    end

    subgraph Observability["Observability Stack"]
        Honeycomb["Honeycomb\nOpenTelemetry\ndistributed tracing"]
        Braintrust["Braintrust\nLLM tracing, eval scoring,\ndynamic prompt mgmt"]
        Sentry["Sentry\nError tracking,\ntransaction tracing"]
        Winston["Winston Logger\nStructured JSON\nwith request IDs"]
    end

    subgraph External["External Services"]
        AzureOAI["Azure OpenAI\nGPT-4.1 / GPT-4.1-nano"]
        EvergreenAPI["Evergreen\nGraphQL API"]
        JiraAPI["Jira REST API"]
        CursorAPI["Cursor Cloud API"]
        GitHub["GitHub"]
        MongoDB[("MongoDB")]
    end

    %% Client → API
    ParsleyUI --> ParsleyRoute
    Slack --> MementoRoute
    DevProdTeams --> LumberRoute
    RelConsumers --> ReleaseRoute
    JiraUI -.->|"label triggers poll"| JiraPoll

    %% API → Agents/Workflows
    ParsleyRoute --> SageThinking
    MementoRoute --> SlackSum
    LumberRoute --> QOwnership
    ReleaseRoute --> RNWF
    UserRoute --> MongoDB

    %% SageThinkingAgent orchestration
    SageThinking --> AgentAsTools
    AgentAsTools --> QClassifier
    AgentAsTools --> Evergreen
    SageThinking --> WFAsTools
    WFAsTools --> LogWF
    WFAsTools --> LogUrlWF

    %% Evergreen tools
    Evergreen --> EGTools
    EGTools --> EvergreenAPI

    %% Release notes workflow
    RNWF --> RNAgent

    %% Sage-Bot flow
    JiraPoll --> AutoPR
    AutoPR --> JiraAPI
    AutoPR --> CursorSvc
    CursorSvc --> CursorAPI
    CursorAPI --> GitHub
    CursorPoll --> CursorSvc
    AutoPR --> MongoDB

    %% Memory
    SageThinking --> Memory
    Memory --> MongoDB

    %% AI model
    Agents --> AzureOAI

    %% Observability (dashed)
    Mastra -.-> Honeycomb
    Mastra -.-> Braintrust
    API -.-> Sentry
    API -.-> Winston
    QOwnership -.->|"loadPrompt()"| Braintrust
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

```mermaid
flowchart TD
    User["User Question\n(via Parsley UI)"] --> STA["SageThinkingAgent"]
    STA --> Classify["askQuestionClassifierAgentTool"]
    Classify --> QCA["QuestionClassifierAgent"]
    QCA --> Decision{Classification Result}

    Decision -->|EVERGREEN| EGPath["askEvergreenAgentTool"]
    EGPath --> EGA["EvergreenAgent"]
    EGA --> GraphQL["Evergreen GraphQL API"]

    Decision -->|LOG| LogPath["logCoreAnalyzerTool"]
    LogPath --> LogWF["logCoreAnalyzerWorkflow"]

    Decision -->|COMBINATION| Both["Both Evergreen +\nLog Analysis"]

    Decision -->|CAN_ANSWER_ON_OWN| Direct["Direct answer\n(no tools)"]

    Decision -->|IRRELEVANT| Decline["Decline to answer"]

    GraphQL --> Response["Streamed Response (SSE)"]
    LogWF --> Response
    Both --> Response
    Direct --> Response
```

### Memory

Each conversation maintains thread-scoped working memory via Mastra Memory backed by MongoDB. The thread ID corresponds to the conversation ID from the client, enabling multi-turn conversations with full context.

## Sage-Bot & Cursor Remote Agents

Sage-Bot is an automated PR generation system that bridges Jira and Cursor Cloud Agents.

### Pipeline

```mermaid
flowchart TD
    Ticket["Jira Ticket\n(labeled 'sage-bot')"] --> Poll["Jira Polling Cronjob\n(scheduled)"]
    Poll --> Service["SageAutoPRBotJiraPollingService"]

    Service --> Dup{"Active duplicate\njob exists?"}
    Dup -->|Yes| Skip["Skip\n(remove label)"]
    Dup -->|No| Process["Process Ticket"]

    Process --> FindUser["Find who added label"]
    FindUser --> RemoveLabel["Remove 'sage-bot' label"]
    RemoveLabel --> CreateJob["Create job run record\nin MongoDB"]
    CreateJob --> Validate{"Validate ticket"}

    Validate -->|Invalid| PostError["Post validation errors\nto Jira"]
    Validate -->|Valid| Launch["Cursor Agent Service"]

    Launch --> BuildPrompt["Build prompt from\nticket data"]
    BuildPrompt --> LaunchAgent["Launch Cursor Cloud Agent\nvia Cursor API"]
    LaunchAgent --> CursorAgent["Cursor Remote Agent"]

    CursorAgent --> Clone["Clone GitHub repo"]
    Clone --> Implement["Implement ticket\nautonomously"]
    Implement --> PR["Auto-create PR\non GitHub"]

    StatusPoll["Cursor Status Polling\nCronjob (scheduled)"] --> CheckStatus["Poll agent status"]
    CheckStatus --> UpdateJob["Update job run record"]
    UpdateJob --> Comment["Post completion/failure\ncomment to Jira"]
```

### User Credential Management

Users store their Cursor API keys via the `/pr-bot/user/cursor-key` endpoints. Keys are encrypted at rest using AES-256 with a server-side encryption key before being stored in MongoDB.

## Observability

Sage uses a layered observability stack covering tracing, error tracking, eval scoring, and structured logging.

```mermaid
graph LR
    subgraph App["Sage Application"]
        Express["Express.js\nRoutes"]
        Agents["Mastra\nAgents"]
        DB["MongoDB\nQueries"]
    end

    subgraph Tracing["Distributed Tracing"]
        OTel["OpenTelemetry SDK\nW3C Trace Context\nAsyncLocalStorage"]
    end

    Express --> OTel
    Agents --> OTel
    DB --> OTel

    OTel -->|"OTLP/HTTP"| Honeycomb["Honeycomb\n- Express spans\n- MongoDB spans\n- Request traces"]

    Agents -->|"BraintrustExporter"| Braintrust["Braintrust\n- LLM call traces\n- Dynamic prompts\n- Eval scores & reports"]

    Express -->|"Error handler"| Sentry["Sentry\n- Unhandled exceptions\n- Transaction sampling (10%)\n- Console capture\n- User context"]

    Express -->|"httpLoggingMiddleware"| Winston["Winston\n- Structured JSON logs\n- Request IDs\n- WinstonMastraLogger"]
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

```mermaid
graph TB
    Sage["Sage"] --> AzureOAI["Azure OpenAI\nGPT-4.1 / GPT-4.1-nano"]
    Sage --> EvergreenAPI["Evergreen GraphQL API\nTask, version, test data"]
    Sage --> JiraAPI["Jira REST API\nTicket polling, comments, labels"]
    Sage --> CursorAPI["Cursor Cloud API\nLaunch/monitor remote agents"]
    CursorAPI --> GitHub["GitHub\nPR creation by Cursor agents"]
    Sage --> MongoDB[("MongoDB\nConversations, credentials,\njob runs, memory")]
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
