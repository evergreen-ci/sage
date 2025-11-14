# Agent Development Guide

This guide provides comprehensive instructions for implementing agents, tools, workflows, and REST routes in the Sage codebase using the Mastra framework.

## Coding Style Guidelines

- **Use arrow functions** for all function declarations (e.g., `const myFunction = () => {}`)
- **Avoid superfluous comments** - code should be self-documenting with clear naming
- **Use TypeScript** for type safety with Zod schemas for validation

## Pull Request Guidelines

When opening PRs, follow these conventions:

### PR Title Format

The PR title should follow the format: `JIRA-TICKET: Summary`

Example: `DEVPROD-23895: Add user authentication workflow`

### PR Description

- Reference the Jira ticket template for the full PR description format
- Include a clear summary of changes
- List any breaking changes
- Add testing instructions
- Reference related tickets/PRs

### Commit Messages

- Follow the same `JIRA-TICKET: Summary` format for commit messages
- Keep commits focused and atomic
- Use conventional commit types when applicable (feat, fix, chore, docs, etc.)

### Prior to pushing code

- Run `yarn format` and `yarn eslint:fix to format the code

## Table of Contents

- [Creating Agents](#creating-agents)
- [Creating Tools](#creating-tools)
- [Creating Workflows](#creating-workflows)
- [Creating REST Routes](#creating-rest-routes)
- [Creating Evals](#creating-evals)
- [Key Patterns](#key-patterns)

---

## Creating Agents

Agents are the core reasoning components built using Mastra's `Agent` class.

### Basic Agent Structure

```typescript
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { gpt41 } from '@/mastra/models/openAI/gpt41';

export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  description: 'Brief description of what this agent does',
  instructions: `
    Detailed system prompt for the agent.
    Define its role, capabilities, rules, and behavior here.
  `,
  model: gpt41,
});
```

### Agent with Structured Output

See [questionClassifierAgent.ts:30-112](src/mastra/agents/planning/questionClassifierAgent.ts#L30-L112):

```typescript
const outputSchema = z.object({
  confidence: z.number().min(0).max(1),
  questionClass: z.enum([
    'EVERGREEN',
    'LOG',
    'COMBINATION',
    'CAN_ANSWER_ON_OWN',
    'IRRELEVANT',
  ]),
  nextAction: z.enum([
    'USE_EVERGREEN_AGENT',
    'USE_LOG_ANALYSIS_AGENT',
    'USE_COMBINATION_ANALYSIS',
    'GENERATE_ANSWER_ON_OWN',
    'DO_NOT_ANSWER',
  ]),
  originalQuestion: z.string().min(1),
});

export const questionClassifierAgent = new Agent({
  id: 'question-classifier-agent',
  name: 'Question Classifier Agent',
  description: 'Classifies a user question and decides the next action.',
  instructions: `...detailed prompt...`,
  defaultGenerateOptions: {
    output: outputSchema,
    temperature: 0,
  },
  model: gpt41,
});
```

### Agent with Tools and Workflows

See [evergreenAgent.ts:51-110](src/mastra/agents/evergreenAgent.ts#L51-L110):

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { Workflow } from '@mastra/core';
import { memoryStore } from '@/mastra/utils/memory';

const myAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread',
      enabled: true,
      template: `# Context Template

## Current Context
- Key: Value
- Details:
`,
    },
    threads: {
      generateTitle: false,
    },
  },
});

export const myAgent: Agent = new Agent({
  name: 'myAgent',
  description: 'Agent that can use tools and workflows',
  instructions: `...`,
  model: gpt41,
  memory: myAgentMemory,
  workflows: {
    myWorkflow: myWorkflow as Workflow<any, any, any, any, any, any>,
  },
  tools: {
    myTool,
    anotherTool,
  },
});
```

### Registering Agents

Add your agent to [src/mastra/index.ts:58-63](src/mastra/index.ts#L58-L63):

```typescript
export const mastra: Mastra = new Mastra({
  agents: {
    sageThinkingAgent,
    evergreenAgent,
    questionClassifierAgent,
    myAgent, // Add your new agent here
  },
  // ...
});
```

**Important**: The field name you use here (e.g., `sageThinkingAgent`, `myAgent`) is what you'll use to reference the agent throughout your codebase with `mastra.getAgent('sageThinkingAgent')`. This is the agent's registration name, not the `id` property defined in the Agent constructor.

---

## Creating Tools

Tools are reusable functions that agents can call to perform specific actions.

### Basic Tool Structure

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

const myToolInputSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});

const myToolOutputSchema = z.object({
  result: z.string(),
});

export const myTool = createTool({
  id: 'myTool',
  description: 'Description of what this tool does',
  inputSchema: myToolInputSchema,
  outputSchema: myToolOutputSchema,
  execute: async ({ context, runtimeContext, mastra }) => {
    const { param1, param2 } = context;
    const result = await doSomething(param1, param2);
    return { result };
  },
});
```

### GraphQL Tool Pattern

See [createGraphQLTool.ts:31-100](src/mastra/utils/graphql/createGraphQLTool.ts#L31-L100) and [getTask.ts:87-95](src/mastra/tools/evergreen/getTask.ts#L87-L95):

```typescript
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import { gql } from 'graphql-tag';
import { z } from 'zod';
import evergreenClient from './graphql/evergreenClient';

const MY_QUERY = gql`
  query MyQuery($id: String!) {
    myResource(id: $id) {
      id
      name
      status
    }
  }
`;

const inputSchema = z.object({
  id: z.string(),
});

const outputSchema = z.object({
  myResource: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  }),
});

export const myGraphQLTool = createGraphQLTool<MyQuery, MyQueryVariables>({
  id: 'myGraphQLTool',
  description: 'Fetches resource data from GraphQL API',
  query: MY_QUERY,
  inputSchema,
  outputSchema,
  client: evergreenClient,
});
```

**Note**: The `createGraphQLTool` helper automatically:

- Retrieves `userId` from RuntimeContext
- Executes the GraphQL query with proper error handling
- Returns typed results based on your outputSchema

### Agent-as-Tool Pattern

See [src/mastra/tools/utils/index.ts:24-56](src/mastra/tools/utils/index.ts#L24-L56):

```typescript
import { createToolFromAgent } from '@/mastra/tools/utils';

// After defining your agent
export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  description: 'Does something specific',
  // ...
});

// Create a tool from the agent
export const askMyAgentTool = createToolFromAgent(
  'myAgent', // Use field name from mastra config, not myAgent.id
  myAgent.getDescription(),
  outputSchema // optional custom output schema
);
```

This allows one agent to invoke another agent as a tool.

**Important**: When referencing agents by name (e.g., in `createToolFromAgent` or `mastra.getAgent()`), use the **field name** from the mastra config, not the agent's `id` field. For example, use `'sageThinkingAgent'` as shown in [src/mastra/index.ts:59](src/mastra/index.ts#L59), not `'sage-thinking-agent'`.

---

## Creating Workflows

Workflows define multi-step processes with state management and control flow.

### Workflow Structure

See [workflows.ts:6-27](src/mastra/workflows/logCoreAnalyzer/workflows.ts#L6-L27):

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const WorkflowInputSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});

const WorkflowOutputSchema = z.object({
  result: z.string(),
  summary: z.string(),
});

const WorkflowStateSchema = z.object({
  intermediateData: z.string().optional(),
  idx: z.number().default(0),
});

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  description: 'Performs a multi-step process',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(stepOne)
  .then(stepTwo)
  .dowhile(stepThree, async ({ state }) => state.idx < someLimit)
  .then(finalStep)
  .commit();
```

### Creating Steps

See [steps.ts:28-96](src/mastra/workflows/logCoreAnalyzer/steps.ts#L28-L96):

```typescript
export const stepOne = createStep({
  id: 'step-one',
  description: 'First step in the workflow',
  inputSchema: WorkflowInputSchema,
  stateSchema: WorkflowStateSchema,
  outputSchema: z.object({
    processedData: z.string(),
  }),
  execute: async ({ inputData, mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    logger.info('Executing step one', { input: inputData });

    const processedData = await processInput(inputData.param1);

    setState({
      ...state,
      intermediateData: processedData,
    });

    tracingContext.currentSpan?.update({
      metadata: {
        stepName: 'step-one',
        dataLength: processedData.length,
      },
    });

    return { processedData };
  },
});

export const stepTwo = createStep({
  id: 'step-two',
  description: 'Second step that uses output from step one',
  inputSchema: z.object({
    processedData: z.string(),
  }),
  stateSchema: WorkflowStateSchema,
  outputSchema: WorkflowOutputSchema,
  execute: async ({
    inputData,
    mastra,
    state,
    tracingContext,
    abortSignal,
  }) => {
    const logger = mastra.getLogger();
    const { processedData } = inputData;
    const { intermediateData } = state;

    const result = await myAgent.generate(processedData, {
      tracingContext,
      abortSignal,
    });

    return {
      result: result.text,
      summary: intermediateData || '',
    };
  },
});
```

### Workflow Control Flow

- **`.then(step)`**: Execute step sequentially
- **`.dowhile(step, condition)`**: Loop while condition is true
- **`.commit()`**: Finalize workflow definition

### Registering Workflows

Add your workflow to [src/mastra/index.ts:34-37](src/mastra/index.ts#L34-L37):

```typescript
export const mastra: Mastra = new Mastra({
  workflows: {
    ...evergreenWorkflows,
    logCoreAnalyzerWorkflow,
    myWorkflow, // Add your new workflow here
  },
  // ...
});
```

---

## Creating REST Routes

REST routes orchestrate agents, workflows, and memory to handle HTTP requests.

### Basic Route Structure

See [index.ts:6-13](src/api-server/routes/completions/parsley/index.ts#L6-L13):

```typescript
import express from 'express';
import myRoute from './myRoute';

const myRouter = express.Router();

myRouter.post('/action', myRoute);
myRouter.get('/:id/status', statusRoute);

export default myRouter;
```

Register the router in [src/api-server/index.ts:66-71](src/api-server/index.ts#L66-L71):

```typescript
private setupRoutes() {
  this.app.get('/', rootRoute);
  this.app.get('/health', healthRoute);
  this.app.use('/completions', completionsRoute);
  this.app.use('/my-endpoint', myRouter); // Add your router here
}
```

### Route Using Agent with Streaming

See [chat.ts:31-218](src/api-server/routes/completions/parsley/chat.ts#L31-L218):

```typescript
import { toAISdkFormat } from '@mastra/ai-sdk';
import { pipeUIMessageStreamToResponse, validateUIMessages } from 'ai';
import { Request, Response } from 'express';
import { trace } from '@opentelemetry/api';
import z from 'zod';
import { mastra } from '@/mastra';
import { USER_ID } from '@/mastra/agents/constants';
import { createParsleyRuntimeContext } from '@/mastra/memory/parsley/runtimeContext';
import { runWithRequestContext } from '@/mastra/utils/requestContext';
import { createAISdkStreamWithMetadata } from '@/utils/ai';
import { logger } from '@/utils/logger';

const inputSchema = z.object({
  id: z.string(),
  message: z.union([z.string(), messageSchema]),
  metadata: z.object({}).optional(),
});

const myRoute = async (req: Request, res: Response) => {
  const currentSpan = trace.getActiveSpan();
  const spanContext = currentSpan?.spanContext();

  const runtimeContext = createParsleyRuntimeContext();
  runtimeContext.set(USER_ID, res.locals.userId);

  const { data, error, success } = inputSchema.safeParse(req.body);
  if (!success) {
    logger.error('Invalid request body', { error });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  if (data.metadata) {
    runtimeContext.set('metadata', data.metadata);

    const workflow = mastra.getWorkflowById('my-preprocessing-workflow');
    const run = await workflow.createRunAsync({});
    const runResult = await run.start({
      inputData: { metadata: data.metadata },
      ...(spanContext
        ? {
            traceId: spanContext.traceId,
            parentSpanId: spanContext.spanId,
          }
        : {}),
      tracingOptions: {
        metadata: {
          userId: res.locals.userId,
          requestId: res.locals.requestId,
        },
      },
      runtimeContext,
    });

    if (runResult.status === 'success') {
      runtimeContext.set('preprocessedData', runResult.result);
    }
  }

  const agent = mastra.getAgent('myAgent');
  const memory = await agent.getMemory({ runtimeContext });

  let memoryOptions = {
    thread: { id: 'undefined' },
    resource: 'undefined',
  };

  const thread = await memory?.getThreadById({ threadId: data.id });
  if (thread) {
    memoryOptions = {
      thread: { id: thread.id },
      resource: thread.resourceId,
    };
  } else {
    const newThread = await memory?.createThread({
      metadata: runtimeContext.toJSON(),
      resourceId: 'my_resource',
      threadId: data.id,
    });
    if (!newThread) {
      res.status(500).json({ message: 'Failed to create thread' });
      return;
    }
    memoryOptions = {
      thread: { id: newThread.id },
      resource: newThread.resourceId,
    };
  }

  try {
    const stream = await runWithRequestContext(
      { userId: res.locals.userId, requestId: res.locals.requestId },
      async () =>
        await agent.stream(data.message, {
          runtimeContext,
          memory: memoryOptions,
          tracingOptions: {
            metadata: {
              userId: res.locals.userId,
              requestID: res.locals.requestId,
            },
            ...(spanContext
              ? {
                  traceId: spanContext.traceId,
                  parentSpanId: spanContext.spanId,
                }
              : {}),
          },
        })
    );

    pipeUIMessageStreamToResponse({
      response: res,
      stream: createAISdkStreamWithMetadata(
        toAISdkFormat(stream, { from: 'agent' })!,
        { spanId: stream.traceId }
      ),
    });
  } catch (error) {
    logger.error('Error in route', { error });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default myRoute;
```

### Route Using Workflow (Non-Streaming)

```typescript
const myWorkflowRoute = async (req: Request, res: Response) => {
  const runtimeContext = createParsleyRuntimeContext();
  runtimeContext.set(USER_ID, res.locals.userId);

  const { data, success } = inputSchema.safeParse(req.body);
  if (!success) {
    res.status(400).json({ message: 'Invalid input' });
    return;
  }

  try {
    const workflow = mastra.getWorkflowById('my-workflow');
    const run = await workflow.createRunAsync({});

    const runResult = await run.start({
      inputData: data,
      tracingOptions: {
        metadata: {
          userId: res.locals.userId,
          requestId: res.locals.requestId,
        },
      },
      runtimeContext,
    });

    if (runResult.status === 'success') {
      res.status(200).json(runResult.result);
    } else {
      logger.error('Workflow failed', { error: runResult.error });
      res.status(500).json({ message: 'Workflow execution failed' });
    }
  } catch (error) {
    logger.error('Error in workflow route', { error });
    res.status(500).json({ message: 'Internal server error' });
  }
};
```

---

## Key Patterns

### 1. Zod Schemas for Type Safety

Always define Zod schemas for:

- Agent input/output
- Tool input/output
- Workflow input/output/state
- Route request bodies

```typescript
import { z } from 'zod';

const mySchema = z.object({
  id: z.string(),
  value: z.number().optional(),
  status: z.enum(['pending', 'complete', 'failed']),
});

type MyType = z.infer<typeof mySchema>;
```

### 2. RuntimeContext for Metadata

RuntimeContext is used to pass metadata between components:

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';
import { USER_ID } from '@/mastra/agents/constants';

type TypeForRuntimeContext = {
  [USER_ID]?: string;
  customKey?: string;
};

const runtimeContext = new RuntimeContext<TypeForRuntimeContext>();
runtimeContext.set(USER_ID, userId);
runtimeContext.set('customKey', customValue);

// Access in tools/agents
const userId = runtimeContext.get(USER_ID);
```

### 3. Tracing with Braintrust

See [src/mastra/index.ts:33-62](src/mastra/index.ts#L33-L62):

```typescript
export const mastra: Mastra = new Mastra({
  observability: {
    configs: {
      braintrust: {
        serviceName: 'sage',
        exporters: [
          new BraintrustExporter({
            apiKey: config.braintrust.apiKey,
            projectName: config.braintrust.projectName,
          }),
        ],
      },
    },
  },
  // ...
});

// In workflow steps
tracingContext.currentSpan?.update({
  metadata: {
    stepName: 'my-step',
    customData: value,
  },
  output: {
    result: outputData,
  },
});
```

### 4. Memory for Conversation Persistence

```typescript
import { Memory } from '@mastra/memory';
import { memoryStore } from '@/mastra/utils/memory';

const myMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread', // or 'resource'
      enabled: true,
      template: `# Memory Template`,
    },
    threads: {
      generateTitle: false,
    },
  },
});

// In routes - create or retrieve thread
const thread = await memory?.getThreadById({ threadId: conversationId });
if (!thread) {
  await memory?.createThread({
    metadata: runtimeContext.toJSON(),
    resourceId: 'my_resource_type',
    threadId: conversationId,
  });
}
```

### 5. Composition Patterns

**Agents can use:**

- Tools (for data fetching)
- Workflows (for multi-step processes)
- Other agents (via agent-as-tool)

**Workflows can:**

- Call agents in steps
- Use tools directly
- Access runtime context

**Routes orchestrate:**

- Workflows for preprocessing
- Agents for reasoning
- Memory for persistence
- Streaming for real-time responses

---

## Common Imports

```typescript
// Agents
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

// Tools
import { createTool } from '@mastra/core';

// Workflows
import { createWorkflow, createStep } from '@mastra/core/workflows';

// Schemas
import { z } from 'zod';

// Models
import { gpt41 } from '@/mastra/models/openAI/gpt41';

// Mastra instance
import { mastra } from '@/mastra';

// Constants
import { USER_ID } from '@/mastra/agents/constants';

// Utils
import { createParsleyRuntimeContext } from '@/mastra/memory/parsley/runtimeContext';
import { memoryStore } from '@/mastra/utils/memory';
import { logger } from '@/utils/logger';
```

---

## Creating Evals

Evals (evaluations) are critical for measuring agent and workflow performance. They use Braintrust for tracking and reporting.

### Eval Structure

Each eval typically consists of:

- **Agent/Workflow Eval File** (`*.eval.ts`): Defines the evaluation task and scoring
- **Reporter File** (`reporter.eval.ts`): Configures result reporting and XML output
- **Types File** (`types.ts`): Defines input/output types and score thresholds
- **Test Cases**: Can be from datasets or hardcoded test cases

### Basic Agent Eval

See [questionClassifierAgent/agent.eval.ts](src/evals/questionClassifierAgent/agent.eval.ts):

```typescript
import { ExactMatch } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { loadTestCases } from '@/evals/loadTestCases';
import { tracedAgentEval } from '@/evals/utils/tracedAgent';
import { QUESTION_CLASSIFIER_AGENT_NAME } from '@/mastra/agents/constants';
import { TestCase, TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('question_classifier_agent_dataset'),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: QUESTION_CLASSIFIER_AGENT_NAME,
      transformResponse: response => {
        const responseJSON = JSON.parse(response.text);
        return {
          questionClass: responseJSON.questionClass,
          nextAction: responseJSON.nextAction,
        };
      },
    }),
    scores: [
      ({ expected, output }) =>
        ExactMatch({
          expected: {
            questionClass: expected.questionClass,
            nextAction: expected.nextAction,
          },
          output: {
            questionClass: output.questionClass,
            nextAction: output.nextAction,
          },
        }),
    ],
    experimentName: 'Question Classifier Agent Eval',
    description: 'Tests for the Question Classifier agent.',
  },
  {
    reporter: ReporterName.QuestionClassifier,
  }
);
```

### Workflow Eval

See [logAnalyzerWorkflow/workflow.eval.ts](src/evals/logAnalyzerWorkflow/workflow.eval.ts):

```typescript
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import z from 'zod';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { TechnicalAccuracy } from '@/evals/scorers';
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';
import { LOG_ANALYZER_WORKFLOW_NAME } from '@/mastra/agents/constants';
import { logCoreAnalyzerWorkflow } from '@/mastra/workflows/logCoreAnalyzer';
import { getTestCases } from './testCases';
import { TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: getTestCases(),
    task: tracedWorkflowEval<
      TestInput,
      TestResult,
      z.infer<typeof logCoreAnalyzerWorkflow.inputSchema>
    >({
      workflowName: LOG_ANALYZER_WORKFLOW_NAME,
      transformInput: async input => {
        try {
          const text = await input.file.data().then(data => data.text());
          return {
            text,
            analysisContext: input.analysisContext,
          };
        } catch (err) {
          throw new Error(
            `Failed to read file "${input.file.reference?.filename ?? 'unknown'}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      },
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: expected.summary,
          output: output.summary,
          input: input.file.reference.filename,
        }),
      ({ expected, output }) =>
        TechnicalAccuracy({
          output: output.summary,
          expected: expected.summary,
        }),
    ],
    experimentName: 'Log Analyzer Workflow Eval',
    description: 'Tests for the Log Analyzer Workflow.',
    maxConcurrency: 2,
  },
  {
    reporter: ReporterName.LogAnalyzerWorkflow,
  }
);
```

### Types File

Define your test case types in `types.ts`:

```typescript
import { BaseTestCase, BaseScores } from '@/evals/types';

export type TestInput = string;

export type TestResult = {
  questionClass: string;
  nextAction: string;
};

export type Scores = BaseScores & {
  ExactMatch: number;
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
```

### Reporter File

Create a reporter to handle evaluation results in `reporter.eval.ts`:

```typescript
import { BaseEvalConfig, createBaseEvalReporter } from '@/evals/baseEval';
import { ReporterName } from '@/evals/constants';
import { createScoreChecker } from '@/evals/scorers';
import { TestCase } from './types';

const createEvalConfig = (): BaseEvalConfig<TestCase> => ({
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
  calculateScores: createScoreChecker,
});

export const reporter = createBaseEvalReporter(createEvalConfig());
```

### Available Scorers

Mastra provides several built-in scorers from the `autoevals` package:

**Exact Match Scorers:**

- `ExactMatch`: Checks for exact equality between expected and output

**LLM-Based Scorers:**

- `Factuality`: Evaluates factual correctness against expected output
- `ContextRelevancy`: Measures relevance of retrieved context
- `Faithfulness`: Checks if output is supported by provided context
- `AnswerRelevancy`: Evaluates if output addresses the input query
- `Hallucination`: Detects factually incorrect information
- `Bias`: Identifies biased content (gender, political, racial, geographical)
- `Toxicity`: Detects toxic, racist, or offensive content

**Custom Scorers:**

- `TechnicalAccuracy`: Custom scorer for technical correctness (see [scorers.ts](src/evals/scorers.ts))
- `ToolUsage`: Validates correct tool usage by agents

### Custom Scorers

Create custom scorers in [src/evals/scorers.ts](src/evals/scorers.ts):

```typescript
import { LLMClassifierFromTemplate } from 'autoevals';

export const TechnicalAccuracy = (args: {
  output: string;
  expected: string;
}) => {
  const technicalAccuracyClassifier = LLMClassifierFromTemplate({
    name: 'TechnicalAccuracy',
    promptTemplate: `
      You are comparing a submitted answer to an expert answer on a given question.
      [BEGIN DATA]
      ************
      [Question]: {{input}}
      ************
      [Expert]: {{expected}}
      ************
      [Submission]: {{output}}
      ************
      [END DATA]

      Evaluate the technical accuracy based on the expected results.
      Ignore differences in style, grammar, or punctuation.

      Return score based on:
      (Not Accurate) The submitted answer is not accurate.
      (Somewhat Accurate) The submitted answer is somewhat accurate with minor inaccuracies.
      (Partially Accurate) The submitted answer is partially accurate with major inaccuracies.
      (Mostly Accurate) The submitted answer is mostly accurate with minor inaccuracies.
      (Accurate) The submitted answer is accurate.
      `,
    choiceScores: {
      'Not Accurate': 0.0,
      'Somewhat Accurate': 0.25,
      'Partially Accurate': 0.5,
      'Mostly Accurate': 0.75,
      Accurate: 1.0,
    },
  });
  return technicalAccuracyClassifier({ output: args.output });
};
```

### Test Data Loading

Load test cases from Braintrust datasets:

```typescript
import { loadTestCases } from '@/evals/loadTestCases';

// Loads from Braintrust dataset named 'question_classifier_agent_dataset'
data: loadTestCases<TestCase>('question_classifier_agent_dataset');
```

Or define test cases directly:

```typescript
export const getTestCases = (): TestCase[] => [
  {
    input: { file: createFile('test.log'), analysisContext: 'Find errors' },
    expected: { summary: 'Expected summary' },
    metadata: {
      testName: 'Test Case 1',
      description: 'Tests error detection',
      scoreThresholds: {
        Factuality: 0.7,
        TechnicalAccuracy: 0.8,
      },
    },
  },
];
```

### Running Evals

Run evals using the provided scripts:

```bash
# Run specific eval by folder path
yarn eval src/evals/questionClassifierAgent

# Run log analyzer workflow eval
yarn eval src/evals/logAnalyzerWorkflow

# Run sage thinking agent eval
yarn eval src/evals/sageThinkingAgent

# Run evergreen agent eval
yarn eval src/evals/evergreenAgent
```

The eval command takes the path to the eval folder and will run all `*.eval.ts` files within that directory.

### Eval Helper Utilities

**tracedAgentEval**: Wraps agent execution with tracing

```typescript
import { tracedAgentEval } from '@/evals/utils/tracedAgent';

task: tracedAgentEval<TestInput, TestResult>({
  agentName: 'myAgent',
  transformResponse: response => ({
    result: JSON.parse(response.text),
  }),
  setupRuntimeContext: input => {
    const ctx = new RuntimeContext();
    ctx.set('userId', 'test-user');
    return ctx;
  },
});
```

**tracedWorkflowEval**: Wraps workflow execution with tracing

```typescript
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';

task: tracedWorkflowEval<TestInput, TestResult, WorkflowInput>({
  workflowName: 'my-workflow',
  transformInput: async input => ({
    processedInput: input.rawData,
  }),
});
```

### Eval Registration

Add your reporter to [src/evals/constants.ts](src/evals/constants.ts):

```typescript
enum ReporterName {
  Evergreen = 'Evergreen Eval Reporter',
  QuestionClassifier = 'Question Classifier Eval Reporter',
  SageThinking = 'Sage Thinking Eval Reporter',
  LogAnalyzerWorkflow = 'Log Analyzer Workflow Eval Reporter',
  MyNewEval = 'My New Eval Reporter', // Add your reporter here
}
```

### Eval Output

Evals generate:

- **Console Output**: Real-time results and scores
- **XML Reports**: JUnit-formatted XML in `/bin` directory
- **Braintrust Tracking**: Results sent to Braintrust for visualization

---

## Registration Checklist

When creating new components:

1. **Agent**: Add to `mastra.agents` in [src/mastra/index.ts](src/mastra/index.ts)
2. **Tool**: Export from relevant tool directory, use in agent's `tools` config
3. **Workflow**: Add to `mastra.workflows` in [src/mastra/index.ts](src/mastra/index.ts)
4. **Route**: Register router in [src/api-server/index.ts](src/api-server/index.ts)
5. **Eval**: Add reporter to `ReporterName` enum in [src/evals/constants.ts](src/evals/constants.ts)

Always ensure proper typing with Zod schemas and include comprehensive error handling.
