# Lumber

DevProd is made up of multiple teams, each owning different parts of the ecosystem. When someone posts a question in #ask-devprod, figuring out which team should handle it takes time and tribal knowledge. Lumber automates this triage — it analyzes a question and routes it to the right team, along with a reasoning explanation.

## How It Works

For example, if someone asks _"How do I configure task timeouts in Evergreen?"_, Lumber determines this is an Evergreen App question and routes it to the Evergreen team with reasoning like: _"This question is about configuring task timeouts, which is a core Evergreen app feature."_

1. A user question is submitted to the API
2. The agent classifies the question using a dynamic prompt loaded from Braintrust (so routing rules can be updated without code changes)
3. It returns the team name, team ID, and reasoning for the decision

## Output Fields

| Field       | Type   | Description                                           |
| ----------- | ------ | ----------------------------------------------------- |
| `teamName`  | string | The DevProd team name that should handle the question |
| `teamId`    | string | The Jira team ID for routing                          |
| `reasoning` | string | Explanation of why this team was selected             |

## Dynamic Prompt Configuration

Lumber's routing rules are managed externally in **Braintrust** (project: `sage-prod`, slug: `slack-question-ownership-agent`) rather than being hardcoded in the source. This means the team can update routing logic — adding new teams, adjusting boundaries between teams, or refining decision criteria — without deploying code. The agent loads its instructions at runtime, supporting both `completion` and `chat` prompt types.

> **Why Braintrust for the prompt?** Team structures and ownership boundaries change more often than the routing agent's code. By storing the prompt externally, the team can iterate on routing accuracy through Braintrust's experimentation tools and measure the impact of prompt changes against eval scores.

## Quick Start

Route a question to the appropriate team:

```bash
curl -X POST https://sage.prod.corp.mongodb.com/completions/lumber/determine-owner \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I configure task timeouts in Evergreen?"}'
```

Response:

```json
{
  "teamName": "Evergreen App",
  "teamId": "evergreen-team-id",
  "reasoning": "The question is about configuring task timeouts, which is a core Evergreen platform feature managed by the Evergreen team."
}
```

## API Reference

### Determine Question Owner

`**POST /completions/lumber/determine-owner**`

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

## Getting Help

If you have questions or encounter issues, reach out in the [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C69UXN1CP) Slack channel.
