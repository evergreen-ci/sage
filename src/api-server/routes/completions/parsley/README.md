# Parsley AI

Debugging Evergreen task failures often involves jumping between the Evergreen UI for task metadata and raw log files that can be tens of megabytes. Parsley AI is a conversational assistant that brings both together — you ask a question in natural language, and it figures out whether it needs task metadata, log analysis, or both, then streams back an evidence-based answer with line references.

To learn more about Parsley AI, see the [Parsley AI documentation](https://docs.devprod.prod.corp.mongodb.com/parsley/Parsley-AI).

To learn more about the technical details of Parsley AI, see the sections below.

## How It Works

1. A user sends a question through the chat API (e.g., "Why did the `compile` task fail on this patch?")
2. The **Question Classifier Agent** categorizes the question — is this about task metadata, log contents, both, general Evergreen knowledge, or something out of scope?
3. Based on the classification, the appropriate specialist is invoked:
   - **Evergreen Agent** for metadata queries (task status, test results, task history)
   - **Log Core Analyzer Workflow** for log file analysis (supports files up to 100MB)
   - Both for combination questions (e.g., "Was this failure introduced recently? Compare with the last passing run.")
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

## Quick Start

Send a message and receive a streamed response:

```bash
curl -N -X POST https://sage.example.com/completions/parsley/conversations/chat \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-conversation-123",
    "message": "What is the status of task abc123?"
  }'
```

The response is a streamed UIMessage — each chunk arrives as it's generated, so you see partial answers immediately. To continue the conversation, send another request with the same `id`:

```bash
curl -N -X POST https://sage.example.com/completions/parsley/conversations/chat \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-conversation-123",
    "message": "What tests failed on that task?"
  }'
```

If you're analyzing a specific log file, provide `logMetadata` to pre-resolve the log URL before the agent starts processing:

```bash
curl -N -X POST https://sage.example.com/completions/parsley/conversations/chat \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-conversation-456",
    "message": "Why did this task fail?",
    "logMetadata": {
      "task_id": "abc123",
      "execution": 0,
      "log_type": "EVERGREEN_TASK_LOGS",
      "origin": "agent"
    }
  }'
```

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

## Getting Help

If you have questions or encounter issues, reach out in the [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C69UXN1CP) Slack channel.
