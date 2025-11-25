import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import { SLACK_QUESTION_OWNERSHIP_AGENT_NAME } from './constants';

/**
 * DevProd Team Definitions
 * Defines the teams that can be responsible for answering user questions
 *
 * TODO (DEVPROD-24049): this should probably be queried from Backstage or Wiki.
 */
const DEVPROD_TEAMS = {
  'DevProd Build Team': {
    id: '26745',
    description: `Team responsible for build tooling, particularly Bazel, including
      compilation, linking, dependencies, and build configurations. Questions about
      EngFlow, remote execution, build caching, Bazel caching, build latency, test
      result caching, and inner loop cycle times should go here.`,
  },
  'DevProd Correctness Team': {
    id: '26746',
    description: `Team responsible for testing infrastructure, code coverage,
      code ownership, and generally code correctness tools and practices. This
      includes tools like Resmoke, Fern, code coverage, Coveralls, local dev
      containers, mocha, jstests, and integration tests. Question about
      Gitdailies setup, repository syncing, or Copybara also belong here, as do
      questions about Github code reviewer sync with out-of-office (OOO) status.`,
  },
  'DevProd Developer Experience': {
    id: '31057',
    description: `Team responsible for Backstage IDP and portal. Questions about
      Backstage UI / backend / plugins go here, as well as anything related to
      internal developer platform or service catalog.`,
  },
  'DevProd Evergreen App': {
    id: '26748',
    description: `Team responsible for Evergreen continuous integration (CI)
      platform and backend. They handle questions about configuring evergreen
      via YAML files, tasks running (or not running) when they should/shouldn't,
      scheduling of tasks, patches, versions, and CI projects.
      This team is typically not responsible for debugging failures within a
      particular task (those go to Unassigned), or understanding what software
      is running on the host executing the task (goes to DevProd Infrastructure).`,
  },
  'DevProd Evergreen UI': {
    id: '26749',
    description: `Team responsible for Evergreen continuous integration system
      user interface, also known as Spruce, and log viewing and analysis tooling
      like Parsley. This team also manages DevProd AI infra known as Sage.
      Questions about what data is/isn't displayed, or how it is organized in
      the UI, or how users can find/interact with it, all belong to this team.
      Questions about the inner workings of Evergreen's backend (eg. scheduling)
      belong to DevProd Evergreen App.`,
  },
  'DevProd Infrastructure': {
    id: '26747',
    description: `Team responsible for underlying AWS infrastructure supporting
      all DevProd systems. This includes AWS networking, what ports are open in
      Evergreen task hosts, and how those hosts reach other resources, including
      storage (AWS S3 and EBS). The team also manages the environments that run
      Evergreen tasks, installing and removing packages on request.`,
  },
  'DevProd Release Infrastructure': {
    id: '26752',
    description: `Team responsible for release engineering tools and processes.
      This includes existing release processes, as well as systems like the feed,
      published MongoDB binaries and containers, Artifactory, the AWS container
      registry (ECR), code signing (Garasign), Private Cloud Tools (PCT), and
      Unified Release Platform (URP).`,
  },
  'DevProd Last Mile Team': {
    id: '26750',
    description: `Team responsible for integrating DevProd tools with critical
      customer needs. Works closely with customer teams to apply DevProd tools
      to their situation. They also own the autogen-todo bot.`,
  },
  'DevProd Performance Infrastructure': {
    id: '26751',
    description: `Team responsible for MongoDB performance testing tools and
      infrastructure, including DSI, Weta, Locust, Signal Processing Service
      (SPS), multipatch runner, and load generation tools.
      The team owns the 10gen/dsi repo, and associated infrastructure for
      performance monitoring tools/infra, including Performance Baron Tools
      and a plugin to the Evergreen UI for performance analysis.`,
  },
  'DevProd Services & Integrations': {
    id: '26754',
    description: `Team responsible for integrations between Github for source
      code management and version control, Jira for work ticket management,
      Slack messaging, and Evergreen continuous integration (CI).
      They own MMS setup/onboarding scripts, pre-commit hooks, CI failure
      management tools like Foliage, Build Baron, and Autoreverter designed to
      help keep the main line of development green. This includes tools to
      detect flaky tests and flag them to users. They also own the Ask DevProd
      slack bot powered by Credal (Central RAG service).
      The team manages cross-service sync via tools like Mothra, including
      Cloud Bot, which keeps PagerDuty oncall schedules aligned with a Google
      Calendar and Slack aliases to page a team's oncall ("rota sync"). They
      also support DevProd online documentation (Pine), automated test selection
      (TSS), and run the Test ROI project.`,
  },
  Unassigned: {
    id: 'unassigned',
    description:
      'Fallback for questions that do not clearly belong to any specific team',
  },
} as const;

type DevProdTeam = keyof typeof DEVPROD_TEAMS;

const TEAM_NAMES = Object.keys(DEVPROD_TEAMS) as DevProdTeam[];

/** Output schema for team routing */
export const questionOwnershipOutputSchema = z.object({
  teamName: z.enum(TEAM_NAMES),
  teamId: z.string(),
  reasoning: z.string().min(1),
  originalQuestion: z.string().min(1),
});

/** @returns Full list of team descriptions in one string. */
const buildTeamDescriptions = (): string =>
  Object.entries(DEVPROD_TEAMS)
    .map(([key, team]) => `- ${key} (ID ${team.id}): ${team.description}`)
    .join('\n');

export const questionOwnershipAgent = new Agent({
  name: SLACK_QUESTION_OWNERSHIP_AGENT_NAME,
  description: `Routes user questions to the appropriate DevProd team 
    based on content analysis.`,
  instructions: `
You are an expert at classifying technical questions into the DevProd
engineering team that is most suited to answer it correctly. Given a
user's question, identify the most appropriate team to handle it.
1) Analyze the user's question. Look for the main systems that they
   are asking about.
2) Determine which DevProd team should handle it from the list below.
   You MUST provide exactly the ID listed for the team you choose. DO
   NOT GUESS and DO NOT MAKE UP IDs.
3) Explain your reasoning
4) Return JSON only that matches the output schema

## Available Teams

${buildTeamDescriptions()}

## Routing Guidelines

1. **Primary Indicators**:
   - Look for explicit mentions of team names or their core technologies
   - Consider the domain and context of the question

2. **Edge Cases**:
   - If question spans multiple teams, pick the primary team and note in reasoning
   - If question is too vague, route to Unassigned
   - If question mentions multiple technologies, prioritize the main subject

3. **Reasoning**:
   - Briefly explain which keywords or concepts led to your decision
   - Mention any historical patterns if applicable
   - Note if the question is ambiguous or spans multiple teams

## Output Contract

Return **only** a JSON object with keys:
{
  "teamName": the name field of one of ${TEAM_NAMES.join(', ')},
  "teamId": the team ID as a string,
  "reasoning": string explaining the routing decision,
  "originalQuestion": string (the user's question)
}

## Examples

### Example 1
Q: "How do I check the status of my Evergreen build?"
A:
{"teamName":"DevProd Evergreen App","teamId":"26748","reasoning":"Question explicitly mentions 'Evergreen build' and relates to build status monitoring, which is core to the Evergreen team.","originalQuestion":"How do I check the status of my Evergreen build?"}

### Example 2
Q: "Where can I find the logs for my failed test?"
A:
{"teamName":"DevProd Evergreen UI","teamId":"26749","reasoning":"Question asks about logs and debugging a failed test, which is handled by the Parsley log analysis team.","originalQuestion":"Where can I find the logs for my failed test?"}

### Example 3
Q: "How do I set up Backstage?"
A:
{"teamName":"DevProd Developer Experience","teamId":"31057","reasoning":"Question about Backstage, which falls under Developer Experience team's domain.","originalQuestion":"How do I set up Backstage?"}

### Example 4
Q: "Our deployment is failing to make it to production"
A:
{"teamName":"DevProd Release Infrastructure","teamId":"26752","reasoning":"Question about production deployment issues relates to platform infrastructure and deployment systems.","originalQuestion":"Our deployment is failing to make it to production"}

### Example 5
Q: "What's for lunch?"
A:
{"teamName":"Unassigned","teamId":"unassigned","reasoning":"Question is unrelated to DevProd team domains and does not match any team keywords or responsibilities.","originalQuestion":"What's for lunch?"}
  `,
  defaultOptions: {
    modelSettings: {
      temperature: 0,
    },
  },
  model: gpt41,
});
