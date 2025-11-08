// Prompts for log files analysis

const MAX_FINAL_SUMMARY_TOKENS = 2048;

// Agent Instructions
export const INITIAL_ANALYZER_INSTRUCTIONS = `You are a senior engineer performing initial analysis of technical text (logs, code, configs, telemetry, build output).
Focus on:
- Understanding the overall structure and format of the content
- Identifying key patterns, sections, and data types
- Establishing context and technical domain
- Preserving critical facts, identifiers, timestamps, error codes
- Creating a strong foundation summary for further refinement`;

export const REFINEMENT_AGENT_INSTRUCTIONS = `You are a technical analyst updating existing summaries with new information.
You always respond as compact JSON matching the provided schema.
- Merge new facts into the existing summary efficiently
- Collapse repeated patterns; prefer timelines for events
- If a new chunk adds nothing material, set "updated": false
- Keep the summary concise while preserving all important details`;

export const REPORT_FORMATTER_INSTRUCTIONS = `You are a senior engineer creating technical reports and summaries.
You respond ONLY with the requested format - no JSON wrapper, no additional fields.
Focus on clarity, precision, and appropriate formatting for the requested output type.`;

// Formatting Requirements
const CONCISE_SUMMARY_REQUIREMENTS = `- 3-4 lines maximum
- Focus on: what happened, key impacts/metrics, critical actions needed
- Plain text only, no markdown formatting
- Be direct and factual`;

const MARKDOWN_REPORT_FORMAT = `Use the following structure with proper Markdown headers:
# Technical Analysis Report

## Overview
(Concise summary of the situation)

## Key Entities/Modules
- Use bullet points
- Include identifiers and technical names

## Timeline / Key Events
(Chronological list with clear sequence)

## Anomalies / Errors
### Error 1 Title
- **Description:** ...
- **Evidence:** ...
- **Likely Cause:** ...

## Metrics / Counts
| Metric | Value |
|--------|-------|
| ... | ... |

## Open Questions / Next Actions
- [ ] Action item 1
- [ ] Action item 2

Format with proper Markdown: use **bold** for emphasis, \`code\` for technical terms, proper headers (#, ##, ###), tables where appropriate.
Keep it <= ${MAX_FINAL_SUMMARY_TOKENS} tokens; compress without losing facts.`;

// Prompt Functions
export const USER_INITIAL_PROMPT = (chunk: string, analysisContext?: string) =>
  `Analyze this first chunk to understand the document structure and create an initial technical summary.
Identify the type of content (logs, code, config, telemetry, etc.) and key patterns.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nUse this context to guide your analysis, focusing on relevant aspects and answering any specific questions.\n` : ''}

Chunk:
"""${chunk}"""

Return:
"<concise but comprehensive summary>"`;

export const USER_REFINE = (
  existing: string,
  chunk: string,
  analysisContext?: string
) =>
  `Refine the existing summary with ONLY *material* additions or corrections from the new chunk.
If the chunk adds nothing substantive, return {"updated": false, "summary": "<unchanged>"}.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nKeep this context in mind while refining the summary.\n` : ''}

Existing summary:
"""${existing}"""

New chunk:
"""${chunk}"""

Return JSON:
{ "updated": <bool>, "summary": "<updated or unchanged>" }`;

export const USER_MARKDOWN_PROMPT = (
  summary: string,
  analysisContext?: string
) =>
  `Rewrite the accumulated summary into a clean technical report formatted as Markdown.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nEnsure the report addresses any specific questions or focus areas mentioned in the context.\n` : ''}

${MARKDOWN_REPORT_FORMAT}

Source material:
"""${summary}"""`;

export const USER_CONCISE_SUMMARY_PROMPT = (
  markdown: string,
  analysisContext?: string
) =>
  `Create a concise summary from this technical report.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nHighlight findings relevant to this context in the summary.\n` : ''}

Requirements:
${CONCISE_SUMMARY_REQUIREMENTS}

Source report:
"""${markdown}"""`;
