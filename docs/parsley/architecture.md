# Parsley AI Architecture

This document provides a technical deep-dive into the agents, workflows, and data flow that power Parsley AI.

## Architecture Overview

```
User Request
    |
POST /completions/parsley/conversations/chat
    |
[chatRoute] Validates request, resolves log URL if logMetadata provided
    |
[sageThinkingAgent] Orchestrator (GPT-4.1, max 10 steps)
    |
    |-- askQuestionClassifierAgentTool
    |       Classifies question -> EVERGREEN / LOG / COMBINATION / CAN_ANSWER_ON_OWN / IRRELEVANT
    |
    |-- askEvergreenAgentTool
    |       |-- getTaskTool (GraphQL)
    |       |-- getTaskTestsTool (GraphQL)
    |       |-- getTaskFilesTool (GraphQL)
    |       |-- getTaskHistoryByIdTool (composite)
    |       |-- getVersionFromTaskTool (GraphQL)
    |
    |-- logCoreAnalyzerTool (workflow-as-tool)
    |       |-- loadDataStep (file / URL / text)
    |       |-- chunkStep (token-aware splitting)
    |       |-- decideAndRunStep
    |               |-- singlePassStep (1 chunk)
    |               |-- iterativeRefinementWorkflow (N chunks)
    |                       |-- initialAnalyzerAgent (GPT-4.1)
    |                       |-- refinementAgent loop (GPT-4.1 Nano)
    |                       |-- finalizeStep
    |
    |-- resolveLogFileUrlTool (workflow-as-tool)
            |-- validateLogMetadata
            |-- Branch: Direct URL (task files / task logs)
            |-- Branch: Test URL (fetch test results, derive URL)
    |
Streamed UIMessage response
```

## Core Agent: sageThinkingAgent

| Property      | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| **ID**        | `sageThinkingAgent`                                        |
| **Model**     | GPT-4.1                                                    |
| **Max Steps** | 10                                                         |
| **Memory**    | Thread-scoped working memory (MongoDB)                     |
| **Role**      | Senior software engineer with Evergreen platform expertise |

The sageThinkingAgent is the top-level orchestrator. It receives user messages, generates an internal checklist of steps, and invokes sub-agents and workflows as needed. It validates tool outcomes after each call and responds with evidence-based markdown answers.

**Source:** `src/mastra/agents/planning/sageThinkingAgent.ts`

## Sub-Agents

### Question Classifier Agent

Classifies user questions to determine the optimal response strategy.

| Property    | Value                                            |
| ----------- | ------------------------------------------------ |
| **ID**      | `questionClassifierAgent`                        |
| **Model**   | GPT-4.1                                          |
| **Pattern** | Agent-as-tool (`askQuestionClassifierAgentTool`) |

**Output Schema:**

| Field              | Type         | Description                                                                                                            |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `confidence`       | number (0-1) | Classification confidence score                                                                                        |
| `questionClass`    | enum         | `EVERGREEN`, `LOG`, `COMBINATION`, `CAN_ANSWER_ON_OWN`, `IRRELEVANT`                                                   |
| `nextAction`       | enum         | `USE_EVERGREEN_AGENT`, `USE_LOG_ANALYSIS_AGENT`, `USE_COMBINATION_ANALYSIS`, `GENERATE_ANSWER_ON_OWN`, `DO_NOT_ANSWER` |
| `originalQuestion` | string       | The user's original question                                                                                           |

**Source:** `src/mastra/agents/planning/questionClassifierAgent.ts`

### Evergreen Agent

Fetches data from Evergreen APIs about tasks, builds, versions, patches, and logs.

| Property    | Value                                   |
| ----------- | --------------------------------------- |
| **ID**      | `evergreenAgent`                        |
| **Model**   | GPT-4.1                                 |
| **Pattern** | Agent-as-tool (`askEvergreenAgentTool`) |

**Available Tools:**

| Tool                     | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `getTaskTool`            | Get task details (status, display name, tests, version, build info) |
| `getTaskTestsTool`       | Get test results with status, duration, and log links               |
| `getTaskFilesTool`       | Get files associated with a task execution                          |
| `getTaskHistoryByIdTool` | Get task execution history (composite: fetches task, then history)  |
| `getVersionFromTaskTool` | Get version and patch details from a task                           |

All Evergreen tools use GraphQL queries against the Evergreen API.

**Source:** `src/mastra/agents/evergreenAgent.ts`

## Workflows

### Log Core Analyzer Workflow

Analyzes raw log/text content and produces structured markdown reports with findings.

| Property    | Value                                    |
| ----------- | ---------------------------------------- |
| **ID**      | `log-core-analyzer`                      |
| **Pattern** | Workflow-as-tool (`logCoreAnalyzerTool`) |

**Input** (exactly one required):

| Field             | Type              | Description                                |
| ----------------- | ----------------- | ------------------------------------------ |
| `path`            | string            | Absolute file path on the local filesystem |
| `url`             | string            | HTTP/HTTPS URL to fetch content from       |
| `text`            | string            | Raw text content as a string               |
| `analysisContext` | string (optional) | Additional instructions for analysis focus |

**Output:**

| Field            | Type   | Description                          |
| ---------------- | ------ | ------------------------------------ |
| `markdown`       | string | Detailed analysis report             |
| `summary`        | string | Concise summary of findings          |
| `lineReferences` | array  | Line-number references with evidence |

**Workflow Steps:**

1. **loadDataStep** - Loads content from file, URL, or text. Normalizes line endings, enforces 100MB limit, adds truncation warnings if needed.
2. **chunkStep** - Token-aware chunking using the `o200k_base` tokenizer. Splits content into chunks of up to 300,000 tokens with 30,000 token overlap (~10%) for cross-chunk context.
3. **decideAndRunStep** - Routes based on chunk count:
   - **Single chunk:** Runs `singlePassStep` for direct analysis
   - **Multiple chunks:** Runs `iterativeRefinementWorkflow`

**Iterative Refinement Workflow** (for large files):

| Stage            | Agent                  | Model        | Purpose                                                  |
| ---------------- | ---------------------- | ------------ | -------------------------------------------------------- |
| Initial analysis | `initialAnalyzerAgent` | GPT-4.1      | First-pass analysis, detects failures and error codes    |
| Refinement loop  | `refinementAgent`      | GPT-4.1 Nano | Processes subsequent chunks, merges findings efficiently |
| Final formatting | `reportFormatterAgent` | GPT-4.1      | Formats combined analysis into user-facing markdown      |

**Configuration** (`src/mastra/workflows/logCoreAnalyzer/config.ts`):

| Setting        | Value                |
| -------------- | -------------------- |
| Max chunk size | 300,000 tokens       |
| Chunk overlap  | 30,000 tokens (~10%) |
| Tokenizer      | o200k_base (GPT-4)   |
| Max file size  | 100 MB               |
| URL timeout    | 30 seconds           |

**Source:** `src/mastra/workflows/logCoreAnalyzer/`

### Resolve Log File URL Workflow

Resolves log file URLs from Evergreen metadata so the log analyzer can access the content.

| Property    | Value                                      |
| ----------- | ------------------------------------------ |
| **ID**      | `resolve-log-file-url`                     |
| **Pattern** | Workflow-as-tool (`resolveLogFileUrlTool`) |

**Input:**

| Field                   | Type              | Description                                                         |
| ----------------------- | ----------------- | ------------------------------------------------------------------- |
| `logMetadata.task_id`   | string            | Evergreen task ID                                                   |
| `logMetadata.execution` | number            | Task execution number                                               |
| `logMetadata.log_type`  | enum              | `EVERGREEN_TASK_FILE`, `EVERGREEN_TASK_LOGS`, `EVERGREEN_TEST_LOGS` |
| `logMetadata.origin`    | string (optional) | Log origin for task logs                                            |
| `logMetadata.test_id`   | string (optional) | Test ID for test logs                                               |
| `logMetadata.group_id`  | string (optional) | Group ID for test logs                                              |
| `logMetadata.fileName`  | string (optional) | File name for task files                                            |

**Workflow Steps:**

1. **validateLogMetadata** - Validates that the input metadata is well-formed
2. **Branch A (Direct logs)** - For `EVERGREEN_TASK_FILE` or `EVERGREEN_TASK_LOGS`: constructs the URL directly
3. **Branch B (Test logs)** - For `EVERGREEN_TEST_LOGS`: fetches test results from Evergreen, then derives the test log URL
4. **chooseLogUrl** - Selects the final URL from whichever branch completed

**Source:** `src/mastra/workflows/evergreen/getLogFileUrlWorkflow/`

## Key Patterns

### Agent-as-Tool

Sub-agents are wrapped as tools using `createToolFromAgent()`, allowing the orchestrator to invoke them as standard tool calls:

- `askQuestionClassifierAgentTool` wraps `questionClassifierAgent`
- `askEvergreenAgentTool` wraps `evergreenAgent`

### Workflow-as-Tool

Workflows are exposed as tools using `createTool()`, executing full workflow runs within a single tool call:

- `logCoreAnalyzerTool` wraps `logCoreAnalyzerWorkflow`
- `resolveLogFileUrlTool` wraps `resolveLogFileUrlWorkflow`

### Request Context

Request context is propagated through all agent/workflow executions using:

- **Mastra RequestContext** - Carries user ID, log metadata, and pre-resolved log URLs
- **AsyncLocalStorage** - Maintains userId and requestId across async boundaries for logging and tracing

### Streaming

Agent responses are streamed to the client:

1. `agent.stream()` produces a Mastra agent stream
2. `toAISdkStream()` converts it to an AI SDK stream
3. `pipeUIMessageStreamToResponse()` pipes it to the Express response with backpressure handling

### Observability

All operations are instrumented with:

- **OpenTelemetry** tracing with trace IDs and parent spans carried through context
- **Braintrust** exporter for experimentation tracking
- **Structured logging** with request IDs for debugging and auditing
