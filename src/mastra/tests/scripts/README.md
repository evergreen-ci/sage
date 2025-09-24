# Local Test Scripts

Scripts for testing the Sage intelligent chatbot locally and with staging.

## Available Scripts

### test-thinking-agent.ts

Tests the sageThinkingAgent locally.

```bash
# Interactive chat mode (simulates UI chatbot)
yarn test-thinking-agent --interactive

# Single question
yarn test-thinking-agent --question "What errors occurred in the logs?"

# With task context
yarn test-thinking-agent --task "task_id" --execution 0 --interactive
```

### chat-with-staging.js

Tests against the deployed staging environment using cookie authentication.

```bash
# Get your cookie from browser DevTools after logging into staging
export SAGE_COOKIE="your_auth_cookies_here"

# Run interactive chat with staging
node src/mastra/tests/scripts/chat-with-staging.js
```

### run-log-analyzer.ts

Tests the log analyzer workflow in isolation.

```bash
# Single file
yarn run-analyzer /path/to/logfile.txt

# Multiple files
yarn run-analyzer file1.log file2.log

# With analysis context
yarn run-analyzer --context "Look for memory leaks" file.log
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Chat Endpoint                 │
│    (/api/completions/parsley/chat)     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       sageThinkingAgent                 │  <--- ACTIVE IN STAGING
│   (Main reasoning & routing agent)      │
└─────────────────────────────────────────┘
                    │
        Has access to these tools:
                    │
        ├── askQuestionClassifierAgentTool
        │   └─> Classifies user questions into categories
        │       (general, evergreen-specific, log-analysis, etc.)
        │
        ├── askEvergreenAgentTool
        │   └─> Handles Evergreen platform queries:
        │       • Task status and details
        │       • Build failures and test results
        │       • Version information
        │       • Historical data analysis
        │
        └── logCoreAnalyzerWorkflow
            └─> Analyzes log files to extract insights:
                • Error detection and categorization
                • Pattern recognition
                • Root cause analysis
                • Performance metrics
```
