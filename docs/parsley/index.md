# Parsley AI

Parsley AI is a conversational assistant for analyzing Evergreen tasks, builds, and logs. It classifies user questions, fetches Evergreen metadata, and performs deep log analysis to provide evidence-based answers with streamed responses.

## Documentation

- [Architecture](./architecture.md) - Technical deep-dive into agents, workflows, and data flow
- [Parsley AI Product Page](https://docs.devprod.prod.corp.mongodb.com/parsley/Parsley-AI) - User-facing documentation for Parsley AI in the DevProd docs

## How It Works

1. A user sends a question through the chat API
2. The **Question Classifier Agent** categorizes the question (Evergreen metadata, log analysis, combination, general knowledge, or irrelevant)
3. Based on the classification, the appropriate sub-agent or workflow is invoked:
   - **Evergreen Agent** for metadata queries (task status, test results, task history)
   - **Log Core Analyzer Workflow** for log file analysis
   - Both for combination questions
   - Direct response for general Evergreen knowledge
4. The response is streamed back to the user with evidence and line references

## Capabilities

| Capability         | Description                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Task queries       | Get task status, details, and metadata from Evergreen                                            |
| Test results       | Retrieve test results with pass/fail status and log links                                        |
| Task history       | View execution history for a task across builds                                                  |
| File listing       | List files associated with a task execution                                                      |
| Version info       | Get version and patch details for a task                                                         |
| Log analysis       | Analyze log files with single-pass or iterative chunked processing for large files (up to 100MB) |
| Log URL resolution | Resolve log file URLs from Evergreen metadata (task logs, task files, test logs)                 |
| General knowledge  | Answer general Evergreen platform questions without tool calls                                   |

## Question Classification

When a user submits a question, the Question Classifier Agent assigns it to one of these categories:

| Class               | Description                          | Example                                                            | Action                   |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------ | ------------------------ |
| `EVERGREEN`         | Metadata-only questions              | "What's the status of task X?"                                     | Use Evergreen Agent      |
| `LOG`               | Requires reading/analyzing logs      | "Why did test A fail in task T?"                                   | Use Log Core Analyzer    |
| `COMBINATION`       | Needs both metadata and log analysis | "Was this failure introduced recently? Compare with last passing." | Use both agents          |
| `CAN_ANSWER_ON_OWN` | General knowledge                    | "What does task status 'undispatched' mean?"                       | Generate answer directly |
| `IRRELEVANT`        | Out of scope                         | "Write me a poem"                                                  | Decline to answer        |

**Edge cases:**

- If the user mentions a specific task/run/test and asks "why/where/how it failed," the question is classified as `LOG`
- If ambiguous between `EVERGREEN` and `LOG`, the classifier prefers `COMBINATION`
- Questions clearly unrelated to Evergreen are classified as `IRRELEVANT`

## API Reference

### Send a Message

**`POST /completions/parsley/conversations/chat`**

Sends a message to Parsley AI and receives a streamed response.

**Request Body:**

| Field         | Type                | Required | Description                                  |
| ------------- | ------------------- | -------- | -------------------------------------------- |
| `id`          | string              | Yes      | Conversation ID (used for thread continuity) |
| `message`     | string or UIMessage | Yes      | The user's message                           |
| `logMetadata` | object              | No       | Metadata for pre-resolving log file URLs     |

**Log Metadata Fields** (when provided):

| Field       | Type   | Required    | Description                                                                |
| ----------- | ------ | ----------- | -------------------------------------------------------------------------- |
| `task_id`   | string | Yes         | Evergreen task ID                                                          |
| `execution` | number | Yes         | Task execution number                                                      |
| `log_type`  | string | Yes         | One of `EVERGREEN_TASK_FILE`, `EVERGREEN_TASK_LOGS`, `EVERGREEN_TEST_LOGS` |
| `origin`    | string | Conditional | Required for `EVERGREEN_TASK_LOGS`                                         |
| `test_id`   | string | Conditional | Required for `EVERGREEN_TEST_LOGS`                                         |
| `group_id`  | string | No          | Optional for `EVERGREEN_TEST_LOGS`                                         |
| `fileName`  | string | Conditional | Required for `EVERGREEN_TASK_FILE`                                         |

**Response:** Streamed UIMessage response.

When `logMetadata` is provided, the log file URL is pre-resolved before the agent processes the message, making it immediately available for log analysis.

### Get Conversation History

**`GET /completions/parsley/conversations/:conversationId/messages`**

Retrieves the message history for an existing conversation.

**Path Parameters:**

| Parameter        | Type   | Required | Description         |
| ---------------- | ------ | -------- | ------------------- |
| `conversationId` | string | Yes      | The conversation ID |

**Response:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What's the status of task abc123?"
    },
    {
      "role": "assistant",
      "content": "The task abc123 is currently in status **failed**..."
    }
  ]
}
```

**Access Control:** Conversations are user-scoped. Only the user who created a conversation can retrieve its messages. Requests from other users return `403 Access denied`.

## Conversation Memory

Parsley AI maintains persistent conversation memory:

- **Storage:** MongoDB-backed via Mastra Memory
- **Scope:** Thread-scoped working memory per conversation
- **Persistence:** Conversations are stored and can be resumed by providing the same conversation ID
- **Access control:** Each thread stores the creating user's ID; only that user can access the conversation

## Getting Help

If you have questions or encounter issues, reach out in the [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C69UXN1CP) Slack channel.
