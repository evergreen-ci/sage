# Log Core Analyzer Workflow

A Mastra workflow that analyzes technical files of any format and produces structured reports with concise summaries.

## Overview

This workflow takes log files or technical documents (via file path, URL, or raw text) and generates:

- A detailed markdown analysis report
- A concise summary

## Architecture

### Input Processing

- **Data Loading** (`dataLoader.ts`): Handles file/URL/text input with size and token validation
- **Configurable Limits** (`config.ts`): Max file size, max tokens, configurable via env vars

### Processing Strategy

The workflow automatically chooses between two approaches based on file size:

#### Single-Pass (small files)

Files that fit in one chunk are processed in a single LLM call for efficiency.

#### Iterative Refinement (large files)

Larger files are processed through:

1. **Initial Analysis**: High-quality model analyzes the first chunk to understand structure
2. **Refinement Loop**: Cheaper model iteratively updates the summary with each chunk
3. **Final Report**: Formatter model generates the final markdown and summary

### Models Used

- **Initial Analysis**: `gpt-4.1` - understands document structure
- **Refinement**: `gpt-4.1-nano` - cost-effective incremental updates
- **Formatting**: `gpt-4.1` - generates final outputs

## Usage

```typescript
const result = await logCoreAnalyzerWorkflow.execute({
  // One of these input methods:
  path: '/path/to/file.log', // Local file
  url: 'https://...', // Remote file
  text: 'raw log content', // Direct text

  // Optional context for analysis
  analysisContext: 'Focus on error patterns',
});

// Returns:
// {
//   markdown: "# Technical Analysis Report...",
//   summary: "Brief summary..."
// }
```

## Configuration

Various parameters can be adjusted in `config.ts` such as token/size limits, models used etc...

## Key Features

- **Token-aware chunking**: Respects model context limits with overlap
- **Size validation**: Prevents OOM errors with configurable limits
- **Source agnostic**: Works with files, URLs, or raw text
- **Adaptive processing**: Optimizes for file size automatically
- **Structured output**: Consistent markdown format with sections for entities, timeline, anomalies, metrics, and next actions

## Files

- `config.ts` - Configuration and limits
- `constants.ts` - Shared constants (source types)
- `dataLoader.ts` - I/O operations and validation
- `prompts.ts` - LLM instruction templates
- `../logCoreAnalyzerWorkflow.ts` - Main workflow definition
