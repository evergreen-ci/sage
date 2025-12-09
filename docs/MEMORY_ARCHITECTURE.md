# Memory Architecture in Sage

## Overview

Sage uses **MongoDB-backed memory storage** to provide conversational context to agents, enabling them to maintain context across multiple interactions within a conversation thread. This improves agent performance by allowing it to recall previous messages and maintain continuity.

## Architecture

### Storage Backend

- **Database**: MongoDB (configured via `MONGODB_URI` and `DB_NAME` environment variables)
- **Storage Implementation**: `MongoDBStore` from `@mastra/mongodb` package
- **Location**: `src/mastra/utils/memory/index.ts`

```typescript
export const memoryStore = new MongoDBStore({
  dbName: config.db.dbName,
  url: config.db.mongodbUri,
});
```

### Memory Configuration

Agents configure memory with two key features:

1. **Working Memory**: Automatically injects structured context into the agent's prompt
2. **Threads**: Manages conversation threads for context persistence

#### Example: Evergreen Agent

```typescript
const evergreenAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread', // Context is scoped to the conversation thread
      enabled: true,
      template: `# Evergreen Task Context

## Current Task
- Task ID:
- Task Name:
- Execution ID:
- Status:
...
`,
    },
    threads: {
      generateTitle: false, // Don't auto-generate thread titles
    },
  },
});
```

## How Memory Improves the Agent

### 1. **Conversation Continuity**

Memory stores all messages in a conversation thread, allowing the agent to:

- Reference previous questions and answers
- Maintain context across multiple turns
- Understand follow-up questions that depend on earlier context

**Example Flow:**

```
User: "What's the status of task ABC123?"
Agent: "Task ABC123 is running..."

User: "What about its test results?"  ← Agent remembers ABC123 from context
Agent: "The test results for ABC123 show..."
```

### 2. **Working Memory Templates**

The `workingMemory.template` feature automatically structures context from the conversation history into a formatted prompt section. This helps the agent:

- Focus on relevant information
- Understand the current task/context
- Make better decisions based on structured context

**Example**: The Evergreen Agent's template extracts task details, status, and analysis notes from the conversation and presents them in a structured format to the agent.

### 3. **Persistent Context**

Unlike stateless API calls, memory persists across:

- Multiple requests in the same conversation
- Server restarts (stored in MongoDB)
- Different sessions (if using the same thread ID)

### 4. **Multi-Agent Context Sharing**

When agents call other agents as tools, they can share memory context, enabling:

- Coordinated multi-agent workflows
- Context propagation between specialized agents
- Better tool selection based on conversation history

## Implementation Details

### Thread Management

**Creating/Retrieving Threads** (`src/api-server/routes/completions/parsley/chat.ts`):

```typescript
// Check if thread exists
const thread = await memory?.getThreadById({ threadId: conversationId });

if (thread) {
  // Use existing thread
  memoryOptions = {
    thread: { id: thread.id },
    resource: thread.resourceId,
  };
} else {
  // Create new thread
  const newThread = await memory?.createThread({
    metadata: runtimeContext.toJSON(),
    resourceId: 'parsley_completions',
    threadId: conversationId,
  });
}
```

### Message Storage

Messages are automatically stored when agents generate responses:

- User messages are stored as input
- Agent responses are stored as output
- Both are linked to the thread ID

### Querying Memory

**Retrieving Messages** (`src/api-server/routes/completions/parsley/getMessages.ts`):

```typescript
const messages = await memory.query({
  threadId: conversationId,
});
```

## Current Agents Using Memory

1. **`sageThinkingAgent`** (`src/mastra/agents/planning/sageThinkingAgent.ts`)
   - Main conversational agent for Parsley
   - Uses thread-scoped working memory
   - Maintains context for multi-turn conversations

2. **`evergreenAgent`** (`src/mastra/agents/evergreenAgent.ts`)
   - Specialized agent for Evergreen system queries
   - Uses structured working memory template for task context
   - Thread-scoped memory for task-specific conversations

## What Memory Does NOT Do

⚠️ **Important**: Memory is **NOT** used for:

- **Model Training/Fine-tuning**: It doesn't improve the base LLM model
- **Learning from Past Conversations**: It doesn't train on historical data
- **Cross-User Learning**: Each thread is isolated per conversation

Memory is purely for **conversational context** within a single thread, not for improving the underlying model capabilities.

## Database Schema

MongoDB stores:

- **Threads**: Conversation threads with metadata (user ID, resource ID, etc.)
- **Messages**: Individual messages within threads (user inputs and agent outputs)

Tables:

- `TABLE_THREADS`: Thread metadata and context
- `TABLE_MESSAGES`: Individual messages linked to threads

## Configuration

Memory requires MongoDB configuration in environment variables:

```bash
MONGODB_URI=mongodb://localhost:27017  # MongoDB connection string
DB_NAME=sage                           # Database name
```

## Future Enhancements

Potential improvements to memory:

1. **Cross-thread context**: Share relevant context across related threads
2. **Semantic search**: Query memory by meaning, not just thread ID
3. **Context summarization**: Compress long conversations while preserving key information
4. **Memory pruning**: Automatically remove outdated or irrelevant context
