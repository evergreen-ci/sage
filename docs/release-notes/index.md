# Release Notes

Writing release notes from dozens of Jira issues is tedious, error-prone, and time-consuming. The Release Notes workflow automates this by reading through Jira issues and pull request metadata, then generating structured, citation-backed release notes grouped into user-facing sections.

## How It Works

The workflow runs a four-step pipeline:

1. **Plan Sections** — Reads through the Jira issues and figures out which section each belongs to (e.g., "Improvements" vs. "Bug Fixes"). It also detects security issues and checks for curated copy in issue metadata that should be used verbatim.
2. **Format Prompt** — Converts the section plans into a structured prompt for the AI agent, including what each section should focus on and the relevant issue details.
3. **Generate** — Calls the Release Notes Agent to produce structured release notes with retry logic on failure.
4. **Validate** — Checks that the output matches the expected schema and that every actionable item has proper Jira citations. This catches hallucinated ticket numbers and missing references.

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

### Curated Copy Priority

Product teams sometimes write their own release note text in Jira fields. When this exists, the workflow respects it rather than generating new copy. It checks issue metadata in this order:

1. `release_notes`
2. `customer_impact`
3. `upgrade_notes`

The first non-empty value is used as the basis for the bullet text. If no curated copy exists, the workflow falls back to the issue summary and description.

> **Why this priority order?** `release_notes` is the most specific and intentional field — if someone wrote it, they meant it to appear in the release notes. `customer_impact` and `upgrade_notes` are progressively less specific but still curated by humans, so they're preferred over AI-generated text.

### Security Issue Detection

Issues are flagged as security-related if the issue type or summary contains keywords like `CVE`, `VULNERABILITY`, or `SECURITY`. Security issues receive special treatment:

- Grouped under a parent bullet with sub-bullets per vulnerability
- Special formatting guidance in the prompt

### Citation Validation

Release notes are only useful if readers can trace each change back to its source. The validation step enforces strict citation requirements:

- Every leaf item (no subitems) must have citations, either its own or inherited from a parent
- Grouping bullets with subitems are valid if all subitems are valid
- Subitems can inherit citations from their parent item
- Empty citation arrays (`"citations": []`) are invalid and cause validation failure

> **Why strict citation validation?** Without it, the model occasionally generates plausible-sounding but uncited items, or cites ticket numbers that don't exist in the input. The validation step catches these before they reach users.

### Section Focus Derivation

Section titles are automatically mapped to focus descriptions:

| Title Keywords                                      | Focus                                    |
| --------------------------------------------------- | ---------------------------------------- |
| improvement, enhancement, feature, new, upgrade     | Enhancements and new capabilities        |
| bug, fix, stability, quality, reliability           | Resolved defects and quality fixes       |
| security, vulnerability, cve, compliance, hardening | Security and vulnerability remediation   |
| Other                                               | Key updates related to the section title |

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
