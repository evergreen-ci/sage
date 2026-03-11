# Release Notes

Writing release notes from dozens of Jira issues is tedious, error-prone, and time-consuming. The Release Notes workflow automates this by reading through Jira issues and pull request metadata, then generating structured, citation-backed release notes grouped into user-facing sections.

## How It Works

You provide Jira issues (and optionally section titles and formatting guidelines), and the workflow returns structured release notes with every item traced back to its source issues. If your Jira issues contain curated release note text in metadata fields, the workflow uses that verbatim instead of generating new copy.

## Quick Start

Generate release notes from a set of Jira issues:

```bash
curl -X POST https://sage.example.com/completions/release-notes/generate \
  -H "Content-Type: application/json" \
  -d '{
    "jiraIssues": [
      {
        "key": "CLOUDP-12345",
        "issueType": "Bug",
        "summary": "Fix memory leak in connection pooling"
      }
    ],
    "sections": ["Improvements", "Bug Fixes"]
  }'
```

The response is a JSON object with sections and items, each item citing the Jira issues it was derived from. See [Output Format](#output-format) for the full structure.

## Input Requirements

The workflow needs Jira issues as its primary input. You can optionally customize which sections appear in the output and provide product-specific formatting guidelines.

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

- **Curated copy priority** — If your Jira issues contain text in `release_notes`, `customer_impact`, or `upgrade_notes` metadata fields, that text is used verbatim instead of AI-generated copy.
- **Security issue detection** — Issues with keywords like `CVE`, `VULNERABILITY`, or `SECURITY` are automatically grouped under a dedicated section with sub-bullets per vulnerability.
- **Citation validation** — Every item in the output is validated to have proper Jira citations tracing back to source issues. This prevents hallucinated ticket numbers and missing references.

## API Reference

### Generate Release Notes

**`POST /completions/release-notes/generate`**

Generates structured release notes from Jira issues.

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

## Getting Help

If you have questions or encounter issues, reach out in the [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C69UXN1CP) Slack channel.
