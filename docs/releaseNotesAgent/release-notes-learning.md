# Release Notes Learning from Published Content

## Overview

This feature enables the release notes agent to learn from human-reviewed and published release notes. After a release is published, the final version is stored in product-specific memory, allowing the agent to improve future generations by learning from actual production patterns.

## Workflow

```
1. Agent generates release notes
   ↓
2. Human reviews and edits as needed
   ↓
3. Release notes are published
   ↓
4. Published version is stored in memory (via API)
   ↓
5. Future generations learn from published examples
```

## Benefits

- **Learns from real production content**: Uses actual published release notes, not synthetic data
- **Human-curated quality**: Only stores content that has been reviewed and approved
- **Product-specific learning**: Each product learns independently
- **Improves over time**: More published releases = better future generations
- **No manual seeding required**: Learning happens organically from usage

## API Design

### Endpoint: `POST /release-notes/store-published`

Stores a published release notes version for learning.

**Request Body:**

```typescript
{
  product: string;                    // Required: Product name (e.g., "ops-manager")
  version: string;                     // Required: Release version (e.g., "8.0.16")
  publishedReleaseNotes: {             // Required: The final published release notes
    sections: ReleaseNotesSection[];
  };
  metadata?: {                        // Optional: Additional metadata
    publishedAt?: string;              // ISO timestamp when published
    publishedBy?: string;              // User ID or name who published
    source?: string;                   // Source system (e.g., "kanopy", "manual")
    notes?: string;                    // Any additional notes
  };
}
```

**Response:**

```typescript
{
  success: boolean;
  message: string;
  threadId?: string;                  // Memory thread ID where stored
  resourceId?: string;                // Product resource ID
}
```

**Example Request:**

```json
{
  "product": "ops-manager",
  "version": "8.0.16",
  "publishedReleaseNotes": {
    "sections": [
      {
        "title": "Improvements",
        "items": [
          {
            "text": "Updates the MongoDB Agent to `108.0.16.8895-1`.",
            "citations": ["CLOUDP-353364"],
            "links": [
              {
                "text": "MongoDB Agent",
                "url": "https://www.mongodb.com/docs/ops-manager/current/release-notes/mongodb-agent/#std-label-mongodb-108.0.16.8895-1"
              }
            ]
          }
        ]
      }
    ]
  },
  "metadata": {
    "publishedAt": "2025-12-09T10:00:00Z",
    "publishedBy": "user-123",
    "source": "kanopy"
  }
}
```

### Endpoint: `GET /release-notes/published/:product`

Retrieves all published release notes for a product (for review/debugging).

**Query Parameters:**

- `limit?: number` - Max number of versions to return (default: 10)
- `offset?: number` - Pagination offset

**Response:**

```typescript
{
  product: string;
  versions: Array<{
    version: string;
    publishedAt: string;
    publishedBy?: string;
    threadId: string;
  }>;
  total: number;
}
```

## Data Storage

### Memory Structure

**Resource ID**: `release_notes:${product}` (same as generation threads)

**Thread Structure**:

- **Thread ID**: `${product}-published-${version}` (e.g., `ops-manager-published-8.0.16`)
- **Metadata**:
  ```typescript
  {
    product: string;
    version: string;
    type: "published";              // Distinguishes from generation threads
    publishedAt: string;
    publishedBy?: string;
    source?: string;
    notes?: string;
  }
  ```
- **Message**: Stores the published release notes as JSON

### Working Memory Integration

The existing working memory template will automatically include published examples:

```typescript
template: `# Release Notes Context - {{product}}

## Published Examples
{{#publishedExamples}}
- Version {{version}} (published {{publishedAt}}):
  {{publishedReleaseNotes}}
{{/publishedExamples}}

## Product-Specific Patterns Learned Over Time
{{#learnedPatterns}}
- {{learnedPatterns}}
{{/learnedPatterns}}

## Style Preferences
{{#stylePreferences}}
- {{stylePreferences}}
{{/stylePreferences}}

## Common Feedback & Corrections
{{#feedback}}
- {{feedback}}
{{/feedback}}
`;
```

Note: The template variables (`{{#publishedExamples}}`) are automatically populated by Mastra's memory system based on messages stored in the resource-scoped memory.

## Implementation Steps

### Phase 1: Basic Storage (MVP)

1. **Create route handler** (`src/api-server/routes/releaseNotes.ts`)
   - Add `POST /store-published` endpoint
   - Validate input schema
   - Store in memory with proper metadata
   - Return success/error response

2. **Input schema** (`src/mastra/agents/releaseNotesAgent.ts`)

   ```typescript
   const storePublishedReleaseNotesInputSchema = z.object({
     product: z.string().min(1),
     version: z.string().min(1),
     publishedReleaseNotes: releaseNotesOutputSchema,
     metadata: z
       .object({
         publishedAt: z.string().optional(),
         publishedBy: z.string().optional(),
         source: z.string().optional(),
         notes: z.string().optional(),
       })
       .optional(),
   });
   ```

3. **Storage function**

   ```typescript
   const storePublishedReleaseNotes = async (
     input: z.infer<typeof storePublishedReleaseNotesInputSchema>,
     runtimeContext: RuntimeContext
   ): Promise<{ threadId: string; resourceId: string }> => {
     // Get agent memory
     // Create thread with published metadata
     // Store published release notes as message
     // Return thread/resource IDs
   };
   ```

4. **Authentication/Authorization**
   - Require authentication (already handled by middleware)
   - Consider adding authorization check (e.g., only certain users can store published notes)

### Phase 2: Retrieval & Management

1. **Add GET endpoint** for listing published versions
2. **Add DELETE endpoint** (optional) for removing incorrect entries
3. **Add validation** to prevent duplicate versions

### Phase 3: Integration with Publishing Workflow

1. **Webhook/Integration**: Automatically store when release notes are published
2. **Slack integration**: Store via Slack command after publishing
3. **Kanopy integration**: Auto-store when release notes are published from Kanopy

## Security Considerations

1. **Authentication**: Require valid user authentication
2. **Authorization**: Consider restricting to specific roles/users
3. **Validation**: Strictly validate published release notes match schema
4. **Rate limiting**: Prevent abuse of storage endpoint
5. **Audit logging**: Log all storage operations for traceability

## Error Handling

- **Invalid product**: Return 400 error
- **Duplicate version**: Return 409 Conflict or update existing
- **Invalid release notes schema**: Return 400 with validation errors
- **Memory storage failure**: Return 500 with error details
- **Missing required fields**: Return 400 with field errors

## Future Enhancements

### 1. Pattern Extraction

Automatically analyze published release notes to extract:

- Common structures
- Style patterns
- Formatting preferences
- Section ordering

### 2. Version Comparison

Compare agent-generated vs published to identify:

- Common edits made by humans
- Patterns in what gets changed
- Areas where agent needs improvement

### 3. Feedback Loop

- Allow users to provide explicit feedback: "This was good" / "This needed changes"
- Store feedback alongside published notes
- Use feedback to weight learning (prioritize highly-rated examples)

### 4. Multi-Product Support

- Support storing published notes for multiple products
- Each product learns independently
- Cross-product pattern analysis (optional)

### 5. Analytics

- Track how many published examples per product
- Measure improvement over time
- Identify products that need more examples

## Example Usage Flow

### 1. Generate Release Notes

```bash
POST /release-notes
{
  "product": "ops-manager",
  "jiraIssues": [...],
  "customGuidelines": "..."
}
```

### 2. Human Reviews & Publishes

(Human edits the generated release notes and publishes them)

### 3. Store Published Version

```bash
POST /release-notes/store-published
{
  "product": "ops-manager",
  "version": "8.0.16",
  "publishedReleaseNotes": {
    "sections": [...]  // Final published version
  },
  "metadata": {
    "publishedAt": "2025-12-09T10:00:00Z",
    "publishedBy": "user-123",
    "source": "kanopy"
  }
}
```

### 4. Future Generations Learn

Next time someone generates release notes for `ops-manager`, the agent will have access to the published example in its working memory context.

## Testing Strategy

1. **Unit Tests**
   - Test storage function with valid/invalid inputs
   - Test memory thread creation
   - Test duplicate version handling

2. **Integration Tests**
   - Test full API endpoint
   - Test memory retrieval
   - Test working memory template includes published examples

3. **E2E Tests**
   - Generate → Store → Generate again
   - Verify second generation improves based on stored example

## Open Questions

1. **Duplicate versions**: Should we allow overwriting existing published versions, or return an error?
2. **Version format**: Should we validate version format (semver, etc.) or accept any string?
3. **Retention**: Should we limit how many published examples to keep per product?
4. **Privacy**: Are there any concerns about storing published release notes in memory?
5. **Performance**: How many published examples can we store before memory becomes too large?

## Related Files

- `src/api-server/routes/releaseNotes.ts` - Route handlers
- `src/mastra/agents/releaseNotesAgent.ts` - Agent and schemas
- `src/mastra/agents/releaseNotesAgent/memorySeed.ts` - (Can be removed, replaced by this feature)
- `src/mastra/utils/memory/index.ts` - Memory store configuration

## Implementation Priority

**High Priority** (MVP):

- Basic storage endpoint
- Input validation
- Memory storage

**Medium Priority**:

- Retrieval endpoint
- Duplicate handling
- Better error messages

**Low Priority** (Future):

- Pattern extraction
- Analytics
- Webhook integration
