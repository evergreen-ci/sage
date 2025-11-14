/**
 * DevProd Team Definitions
 * Defines the teams that can be responsible for answering user questions
 */
export const DEVPROD_TEAMS = {
  'DevProd Build Team': {
    id: '26745',
    description: `Team responsible for build tooling, particularly Bazel, including
      compilation, linking, dependencies, and build configurations`,
  },
  'DevProd Correctness Team': {
    id: '26746',
    description: `Team responsible for testing infrastructure, code coverage, code
      ownership, and generally code correctness tools and practices.`,
  },
  'DevProd Developer Experience': {
    id: '31057',
    description: 'Team responsible for Backstage portal.',
  },
  'DevProd Evergreen App': {
    id: '26748',
    description: `Team responsible for Evergreen CI/CD platform - handles questions about
      versions, builds, tasks, patches, test execution, and CI/CD pipelines`,
  },
  'DevProd Evergreen UI': {
    id: '26749',
    description: `Team responsible for Evergreen platform user interface, also known as
      Spruce, and log viewing and analysis tooling like Parsley.`,
  },
  'DevProd Infrastructure': {
    id: '26747',
    description:
      "Team responsible for CI runtime environment and DevProd's AWS infrastructure.",
  },
  'DevProd Release Infrastructure': {
    id: '26752',
    description: `Team responsible for release engineering tools and processes, including
      Artifactory, code signing, Garasign, PCT, and Unified Release Platform (URP).`,
  },
  'DevProd Last Mile Team': {
    id: '26750',
    description:
      'Team responsible for integrating DevProd tools with critical customer needs.',
  },
  'DevProd Performance Infrastructure': {
    id: '26751',
    description: `Team responsible for performance testing and monitoring infrastructure,
      including DSI, Weta, Locust, Signal Processing Service (SPS), multipatch
      runner, and load generation tools.`,
  },
  'DevProd Services & Integrations': {
    id: '26754',
    description: `Team responsible for integrations into Github, Jira, Slack, and CI/CD
      task failure management tools like Foliage, Build Baron, and Autoreverter.
      Also manages cross-service syncs via Mothra, including PagerDuty and oncall
      rota sync`,
  },
  Unassigned: {
    id: 'unassigned',
    description:
      'Fallback for questions that do not clearly belong to any specific team',
  },
} as const;

export type DevProdTeam = keyof typeof DEVPROD_TEAMS;

export const TEAM_NAMES = Object.keys(DEVPROD_TEAMS) as DevProdTeam[];
