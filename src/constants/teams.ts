/**
 * DevProd Team Definitions
 * Defines the teams that can be responsible for answering user questions
 */
export const DEVPROD_TEAMS = {
  'DevProd Build Team': {
    id: '26745',
    description: `Team responsible for build tooling, particularly Bazel, including
      compilation, linking, dependencies, and build configurations. Questions about
      EngFlow, remote execution, build caching, Bazel caching, build latency, test
      result caching, and inner loop cycle times should go here.`,
  },
  'DevProd Correctness Team': {
    id: '26746',
    description: `Team responsible for testing infrastructure, code coverage, code
      ownership, and generally code correctness tools and practices. This includes
      tools like Resmoke, Fern, code coverage, Coveralls, local dev containers,
      mocha, jstests, and integration tests.`,
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
      to their situation.`,
  },
  'DevProd Performance Infrastructure': {
    id: '26751',
    description: `Team responsible for MongoDB performance testing tools and
      infrastructure, including DSI, Weta, Locust, Signal Processing Service
      (SPS), multipatch runner, and load generation tools. The team also owns
      performance monitoring tools/infra, including Performance Baron Tools
      and a plugin to the Evergreen UI for performance analysis.`,
  },
  'DevProd Services & Integrations': {
    id: '26754',
    description: `Team responsible for integrations between Github for source
      code management and version control, Jira for work ticket management,
      Slack messaging, and Evergreen continuous integration (CI).
      They own CI failure management tools like Foliage, Build Baron, and
      Autoreverter designed to help keep the main line of development green.
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

export type DevProdTeam = keyof typeof DEVPROD_TEAMS;

export const TEAM_NAMES = Object.keys(DEVPROD_TEAMS) as DevProdTeam[];
