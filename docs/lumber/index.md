# Lumber

Lumber analyzes user questions and routes them to the appropriate DevProd team. It provides a team name, team ID, and reasoning for the routing decision, enabling automated question triage in Slack and other channels.

## How It Works

1. A user question is submitted to the API
2. The agent classifies the question using a dynamic prompt loaded from Braintrust
3. It returns the team that should handle the question, along with a reasoning explanation

## Output Fields

| Field       | Type   | Description                                           |
| ----------- | ------ | ----------------------------------------------------- |
| `teamName`  | string | The DevProd team name that should handle the question |
| `teamId`    | string | The Jira team ID for routing                          |
| `reasoning` | string | Explanation of why this team was selected             |

## Dynamic Prompt Configuration

Lumber's routing rules are managed externally in **Braintrust** rather than being hardcoded:

| Setting     | Value                            |
| ----------- | -------------------------------- |
| **Project** | `sage-prod`                      |
| **Slug**    | `slack-question-ownership-agent` |

This means routing logic can be updated without code changes by modifying the prompt in Braintrust. The agent loads its instructions at runtime, supporting both `completion` and `chat` prompt types.

## API Reference

### Determine Question Owner

**`POST /completions/lumber/determine-owner`**

Routes a user question to the appropriate DevProd team.

**Request Body:**

| Field      | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `question` | string | Yes      | The user's question to route |

**Example Request:**

```json
{
  "question": "How do I configure task timeouts in Evergreen?"
}
```

**Example Response:**

```json
{
  "teamName": "Evergreen",
  "teamId": "evergreen-team-id",
  "reasoning": "The question is about configuring task timeouts, which is a core Evergreen platform feature managed by the Evergreen team."
}
```

**Error Responses:**

| Status | Description                                           |
| ------ | ----------------------------------------------------- |
| 400    | Invalid request body (missing or empty `question`)    |
| 500    | Agent not found, not configured, or generation failed |

## Technical Details

| Property              | Value                      |
| --------------------- | -------------------------- |
| **Agent ID**          | `questionOwnershipAgent`   |
| **Model**             | GPT-4.1                    |
| **Temperature**       | 0 (deterministic)          |
| **Tools**             | None (pure classification) |
| **Structured Output** | Enforced via Zod schema    |

The zero temperature setting ensures consistent, deterministic routing decisions for identical questions. The agent uses structured output to guarantee a well-formed response with all required fields.

## Getting Help

If you have questions or encounter issues, reach out in the [#ask-devprod-evergreen](https://mongodb.slack.com/archives/C01PS2CKECQ) Slack channel.
