# Release Notes

The Release Notes workflow generates structured, validated release notes from Jira issues and pull request metadata. It orchestrates a multi-step pipeline that plans sections, formats prompts, generates content via an AI agent, and validates the output for schema compliance and citation correctness.

## How It Works

1. **Plan Sections** - Analyzes Jira issues and maps them to the requested sections. Detects security issues and extracts curated copy from metadata.
2. **Format Prompt** - Converts the section plans into a structured prompt for the release notes agent, including section focus descriptions and issue details.
3. **Generate** - Calls the Release Notes Agent to produce structured release notes with retry logic (2 attempts, 1000ms delay).
4. **Validate** - Validates schema compliance and ensures every actionable item has proper Jira citations.

## Input Requirements

### Top-Level Fields

| Field              | Type   | Required | Default                         | Description                                                        |
| ------------------ | ------ | -------- | ------------------------------- | ------------------------------------------------------------------ |
| `product`          | string | No       | -                               | Product name (e.g., `ops-manager`). Used for tracking and logging. |
| `jiraIssues`       | array  | Yes      | -                               | Array of Jira issue objects (at least one required)                |
| `sections`         | array  | No       | `["Improvements", "Bug Fixes"]` | Ordered list of section titles for the output                      |
| `customGuidelines` | string | No       | -                               | Product-specific formatting guidelines                             |

### Jira Issue Fields

| Field                | Type   | Required | Description                                                                    |
| -------------------- | ------ | -------- | ------------------------------------------------------------------------------ |
| `key`                | string | Yes      | Jira issue key (e.g., `PROJ-123`)                                              |
| `issueType`          | string | Yes      | Type of issue (normalized to uppercase)                                        |
| `summary`            | string | Yes      | Issue title/summary                                                            |
| `description`        | string | No       | Issue description                                                              |
| `additionalMetadata` | object | No       | Key/value pairs (supports `release_notes`, `customer_impact`, `upgrade_notes`) |
| `pullRequests`       | array  | No       | Associated pull requests                                                       |

### Pull Request Fields

| Field         | Type   | Required | Description                         |
| ------------- | ------ | -------- | ----------------------------------- |
| `title`       | string | Yes      | Pull request title                  |
| `description` | string | No       | Pull request description (markdown) |

## Output Format

The output is a JSON object with an array of sections, each containing items:

```json
{
  "sections": [
    {
      "title": "Improvements",
      "items": [
        {
          "text": "Added support for custom task timeouts in project configuration.",
          "citations": ["PROJ-123"],
          "subitems": [
            {
              "text": "Introduced `task_timeout_secs` field in project YAML.",
              "citations": ["PROJ-123"]
            }
          ],
          "links": [
            {
              "text": "custom task timeouts",
              "url": "https://docs.example.com/timeouts"
            }
          ]
        }
      ]
    },
    {
      "title": "Bug Fixes",
      "items": [
        {
          "text": "Fixed memory leak in connection pooling under high load.",
          "citations": ["PROJ-456"]
        }
      ]
    }
  ]
}
```

### Item Fields

| Field       | Type             | Required    | Description                                                                                                                        |
| ----------- | ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `text`      | string           | Yes         | Bullet text describing the change (user-facing impact)                                                                             |
| `citations` | array of strings | Conditional | Jira issue keys supporting this item. Required for actionable items; omit entirely if not applicable (never include empty arrays). |
| `subitems`  | array            | No          | Nested bullet points for additional detail                                                                                         |
| `links`     | array            | No          | Hyperlinks for specific substrings within the text                                                                                 |

## Key Features

### Curated Copy Priority

When generating bullet text, the workflow checks issue metadata in this order:

1. `release_notes`
2. `customer_impact`
3. `upgrade_notes`

The first non-empty value is used as the basis for the bullet text. If no curated copy exists, the workflow falls back to the issue summary and description.

### Security Issue Detection

Issues are flagged as security-related if the issue type or summary contains keywords like `CVE`, `VULNERABILITY`, or `SECURITY`. Security issues receive special treatment:

- Grouped under a parent bullet with sub-bullets per vulnerability
- Special formatting guidance in the prompt

### Citation Validation

The validation step enforces strict citation requirements:

- Every leaf item (no subitems) must have citations, either its own or inherited from a parent
- Grouping bullets with subitems are valid if all subitems are valid
- Subitems can inherit citations from their parent item
- Empty citation arrays (`"citations": []`) are invalid and cause validation failure

### Section Focus Derivation

Section titles are automatically mapped to focus descriptions:

| Title Keywords                                      | Focus                                    |
| --------------------------------------------------- | ---------------------------------------- |
| improvement, enhancement, feature, new, upgrade     | Enhancements and new capabilities        |
| bug, fix, stability, quality, reliability           | Resolved defects and quality fixes       |
| security, vulnerability, cve, compliance, hardening | Security and vulnerability remediation   |
| Other                                               | Key updates related to the section title |

## API Reference

### Generate Release Notes

**`POST /completions/release-notes/generate`**

Generates structured release notes from Jira issues.

**Note:** This endpoint supports a 10MB payload size limit to accommodate large issue lists.

**Example Request:**

```json
{
  "product": "ops-manager",
  "jiraIssues": [
    {
      "key": "CLOUDP-12345",
      "issueType": "Bug",
      "summary": "Fix memory leak in connection pooling",
      "description": "Under high load, connections were not properly released.",
      "additionalMetadata": {
        "release_notes": "Fixed a memory leak in connection pooling that occurred under high load.",
        "customer_impact": "Reduced out-of-memory errors in production deployments."
      },
      "pullRequests": [
        {
          "title": "Fix connection pool cleanup logic",
          "description": "Ensures connections are returned to the pool on timeout."
        }
      ]
    }
  ],
  "sections": ["Improvements", "Bug Fixes"],
  "customGuidelines": "Use MongoDB product terminology."
}
```

**Success Response (200):**

Returns the structured release notes JSON object (see [Output Format](#output-format) above).

**Error Response (400):**

```json
{
  "message": "Invalid request body",
  "errors": {
    "fieldErrors": { "jiraIssues": ["Required"] },
    "formErrors": []
  }
}
```

**Error Response (500):**

```json
{
  "message": "Failed to generate release notes",
  "details": "Workflow error message"
}
```

## Technical Details

| Property          | Value                    |
| ----------------- | ------------------------ |
| **Workflow ID**   | `release-notes`          |
| **Agent ID**      | `release-notes-agent`    |
| **Model**         | GPT-4.1                  |
| **Temperature**   | 0.3                      |
| **Retry Config**  | 2 attempts, 1000ms delay |
| **Payload Limit** | 10 MB                    |

## Getting Help

If you have questions or encounter issues, reach out in the [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C69UXN1CP) Slack channel.
