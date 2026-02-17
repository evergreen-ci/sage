# Sage — The Evergreen AI Service

A TypeScript-wrought Express.js server, forged to furnish the Evergreen AI Service unto its supplicants.

## Commencement of Endeavours

### Prerequisites and Provisions

Ere thou embark upon this undertaking, ensure the following instruments and provisions art at thy disposal:

- Node.js of version twenty-and-two or a release more recent still
- The `pnpm` package manager, duly installed upon thy machine
- A MongoDB instance, properly erected and set to run
- An Azure OpenAI key, procured from the appropriate custodians

### Environment Variables and Their Disposition

Variables bereft of secrecy are chronicled within `.env.defaults`, whilst those peculiar to a given environment reside in `.env.<NODE_ENV>` files of corresponding name.

Thou shalt inscribe thy secrets for external services into `.env.local` or `.env.<NODE_ENV>.local` files, which are shielded from the gaze of git. Shouldst thou lack the necessary credentials, consult the team password manager or beseech a fellow artisan for guidance.

#### The Encryption Key

The environment variable known as `ENCRYPTION_KEY` is required for the encipherment of sensitive data (e.g., user API keys) committed unto MongoDB. It must needs be a hex string of thirty-two bytes — that is to say, sixty-four characters in length — befitting AES-256 encryption.

**The Forging of a New Key:**

```bash
openssl rand -hex 32
```

**Regarding Its Safekeeping:** In deployed dominions, the encryption key is lodged within Kanopy secrets. A default key is furnished in `.env.defaults` for the purposes of local development.

### Installation and Provisioning

1. Clone the repository unto thy local machine, or navigate to the project directory if it already dwelleth therein.
2. Install the requisite dependencies:

   ```bash
   pnpm install
   ```

---

## The Architecture of the Project

```
sage/
├── src/
│   ├── api-server/
│   │   ├── index.ts                  # API server setup
│   │   ├── middlewares/             # Express middlewares
│   │   │   ├── index.ts
│   │   │   └── logging.ts
│   │   ├── routes/                  # HTTP route handlers
│   │   │   ├── completions/
│   │   │   │   ├── index.ts
│   │   │   │   └── parsley.ts
│   │   │   ├── health.ts
│   │   │   ├── index.ts
│   │   │   └── root.ts
│   │   └── types/
│   │       └── index.ts
│   ├── config/
│   │   └── index.ts                  # Environment config
│   ├── db/
│   │   └── connection.ts             # MongoDB connection
│   ├── mastra/                       # Mastra agent framework
│   │   ├── agents/
│   │   │   └── evergreenAgent.ts
│   │   ├── tools/
│   │   │   └── some_tool.ts          # [Tools documentation](https://mastra.ai/en/docs/tools-mcp/overview)
│   │   ├── workflows/
│   │   │   └── some_workflow.ts      # [Workflows documentation](https://mastra.ai/en/docs/workflows/overview)
│   │   ├── models/
│   │   │   └── openAI/
│   │   │       ├── baseModel.ts
│   │   │       └── gpt41.ts
│   │   └── index.ts                  # Mastra setup/exports
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger/
│   │   │   ├── index.ts
│   │   │   ├── setup.ts
│   │   │   ├── winstonMastraLogger.ts
│   │   │   └── logger.test.ts
│   │   └── index.ts
│   ├── __tests__/                    # Unit and integration tests
│   └── main.ts                       # App entry point
├── environments/
│   └── staging.yaml                  # Deployment configuration
├── scripts/                          # Project automation scripts
├── .drone.yml                        # Drone CI pipeline
├── .evergreen.yml                    # Evergreen configuration
├── .env.defaults                     # Shared environment variables
├── .env.<NODE_ENV>                   # Non-secret environment variables
└── README.md
```

---

## The Summoning of the Server

### In the Manner of Development

```bash
pnpm dev
```

This incantation rouses the server by means of `vite-node`, granting unto thee hot-reloading and TypeScript support. The default port upon which it listens is `8080`, though this may be altered by setting the `PORT` environment variable to a value of thy choosing.

### In the Manner of Production

```bash
pnpm build
pnpm start
```

These commands shall compile the TypeScript code and thereafter inaugurate the production server under the dominion of Node.js.

### The Purging of Prior Builds

```bash
pnpm clean
```

This command expunges the `dist/` directory and all its contents from thy filesystem.

---

## Proving the API upon Thy Local Machine

The greater portion of API endpoints demand authentication by way of the `x-kanopy-internal-authorization` header. For the purposes of local development, two avenues of authentication are available unto thee:

### Configuring the Cursor API Key for Local Trials

To assay the Cursor agent integration upon thy local machine, thou must undertake the following:

1. **Procure a Cursor API Key**: Obtain an API key from the [Cursor Dashboard](https://cursor.com/dashboard?tab=integrations). Navigate unto the **API Keys** section and there generate a new key.

2. **Inscribe the Key via REST Endpoints**: Employ the local API endpoints to store thy key:
   - `POST /pr-bot/user/cursor-key` — Create or update thy Cursor API key
   - `GET /pr-bot/user/cursor-key` — Ascertain whether a key hath been registered
   - `DELETE /pr-bot/user/cursor-key` — Remove thy stored key from the records

   By way of illustration:

   ```bash
   curl -X POST http://localhost:8080/pr-bot/user/cursor-key \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-cursor-api-key"}'
   ```

### Option the First: Set the `USER_NAME` Environment Variable (Recommended)

When the `USER_NAME` environment variable is set, the authentication middleware shall employ it as the user identifier, thereby circumventing JWT validation entirely. Inscribe it within thy `.env.local` thusly:

```bash
USER_NAME=your.email@mongodb.com
```

Thereafter, thou mayest prove thine endpoints with simple curl commands:

```bash
curl -X POST http://localhost:8080/pr-bot/user/cursor-key \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key-here"}'
```

### Option the Second: Employ a Counterfeit JWT Header

Shouldst `USER_NAME` remain unset, thou mayest furnish a JWT within the `x-kanopy-internal-authorization` header. The middleware doth only decode the payload — it verifies not the signature — wherefore thou canst construct a test JWT with impunity:

```bash
# JWT payload: {"sub":"test@example.com"}
curl -X POST http://localhost:8080/pr-bot/user/cursor-key \
  -H "Content-Type: application/json" \
  -H "x-kanopy-internal-authorization: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.fake" \
  -d '{"apiKey": "your-api-key-here"}'
```

To fashion a bespoke test JWT, base64-encode thy desired payload:

```bash
echo -n '{"sub":"your.email@mongodb.com"}' | base64
# Employ the output as the middle segment: header.PAYLOAD.signature
```

---

## The Construction of Docker Images

- Docker contexts do now observe `.dockerignore`, and thus local `docker build` and `docker buildx` commands shall pass over voluminous directories such as `node_modules/`, `coverage/`, and generated GraphQL schemas. Shouldst thou require a file that is ignored by default, build with `--no-cache` or temporarily strike the entry from the ignore list.

- The Drone `publish` step maketh use of Kaniko layer caching, buttressed by ECR. Subsequent CI builds shall partake of previously published layers without further entreaty, rendering rebuilds after modest changes considerably swifter.

### Availing Thyself of the CI Cache Locally

Thou mayest opt into the selfsame cache when iterating locally with BuildKit:

1. Authenticate thyself against the Sage ECR registry (by way of example):

   ```bash
   aws ecr get-login-password --region us-east-1 \
     | docker login --username AWS --password-stdin 795250896452.dkr.ecr.us-east-1.amazonaws.com
   ```

2. Invoke `docker buildx build` with the cache image that Drone doth maintain:

   ```bash
   docker buildx build \
     --platform linux/arm64 \
     --cache-from type=registry,ref=795250896452.dkr.ecr.us-east-1.amazonaws.com/devprod-evergreen/${DRONE_REPO_NAME}-cache \
     --cache-to type=registry,ref=795250896452.dkr.ecr.us-east-1.amazonaws.com/devprod-evergreen/${DRONE_REPO_NAME}-cache,mode=max \
     -t sage:local .
   ```

Substitute `${DRONE_REPO_NAME}` with thy repository name shouldst thou be building from a fork (Sage useth `sage`). The `-t sage:local` tag serveth merely as a local image label — name it as thou seest fit. The `--cache-to` flag doth refresh the shared cache so that thy next build — and CI — may partake of the warmed layers.

---

## Concerning the Mastra Agents

The project employeth [Mastra](https://mastra.ai/en/docs/overview), a framework devised for the construction of agentic systems replete with tools and workflows.

### Environment Symlinks and Their Preparation

Mastra's dev server and build process make use of `dotenv-flow` from `src/mastra/public/` to resolve environment variables. Ere thou invoke any Mastra commands, thou must first create the requisite symlinks:

```bash
pnpm mastra:symlink-env
```

This shall forge symlinks for all `.env*` files from the project root into `src/mastra/public/`. These symlinks are hidden from git and need only be fashioned once per clone.

### Rousing the Mastra Dev Server

```bash
pnpm mastra:dev
```

This command launcheth a local Mastra server at `http://localhost:4111`, whereupon thou mayest test thine agents at leisure.

### The Customisation of Agents

- **Agents**: Add or amend agents within `src/mastra/agents`.
- **Tools**: Place reusable tools in `src/mastra/tools`. Tools are composable functions that an agent may call upon in the course of its duties.
- **Workflows**: Add workflows unto `src/mastra/workflows`. Workflows define multi-step logic that agents may follow in their deliberations.

All agents and workflows must needs be registered in `src/mastra/index.ts`.

---

## The GraphQL Apparatus

Sage doth rely upon Evergreen's GraphQL schema for both query linting and type generation. To keep the schema in accord with Evergreen, thou must create a local symlink unto the [Evergreen repository's `graphql/schema`](https://github.com/evergreen-ci/evergreen/tree/master/graphql/schema) directory.

### 1. Establishing the GraphQL Schema Symlink

Execute the following command **from the root of the Sage repository**, supplanting `<path_to_evergreen_repo>` with the absolute path to thy local Evergreen checkout:

```bash
ln -s <path_to_evergreen_repo>/graphql/schema sdlschema
```

This begets a folder-level symlink named `sdlschema/` that Sage's ESLint and GraphQL Code Generator shall discover of their own accord.

### 2. The Linting of GraphQL Queries

With the schema duly symlinked, ESLint shall scrutinise thy `.ts`, `.gql`, and `.graphql` files against the Evergreen schema during the course of development. Thou mayest invoke a manual lint pass at any juncture with:

```bash
pnpm lint
```

### 3. The Generation of GraphQL Types

We employ [`@graphql-codegen`](https://www.graphql-code-generator.com/) to generate TypeScript types for queries, mutations, and their attendant variables. The generated types abide in `src/gql/generated/types.ts`.

Run the generator upon editing or adding GraphQL operations:

```bash
pnpm codegen
```

Shouldst the schema or thy operations change, re-invoke `pnpm codegen` to bring the types into conformity. The command shall also run Prettier upon the generated file.

### Remedies for Common Troubles

- If ESLint or codegen cannot discover the schema, verify the `sdlschema` symlink path and ensure the Evergreen repository resteth upon the expected branch.
- If dependencies appear to be of an outdated vintage, attempt `pnpm install` or `pnpm clean` followed by `pnpm install` to refresh `node_modules`.

## Evals

We employ **evals** to gauge model performance through the [Braintrust platform](https://www.braintrust.dev/docs/start/eval-sdk).

For a fuller accounting of running evals, managing datasets, scoring, and reporting, consult the [Evals documentation](src/evals/README.md).

## Deployment and the Propagation of Changes

### Surveying Pending Commits

Ere thou deploy, it is prudent to ascertain which commits await deployment to a given environment:

1. Switch to the appropriate kubectl context:
   - **Production**: Execute `kcp` (this switcheth to the production context)
   - **Staging**: Execute `kcs` (this switcheth to the staging context)

2. Survey pending commits:

   ```bash
   pnpm pending-commits
   ```

   For output rendered in JSON:

   ```bash
   pnpm pending-commits:json
   ```

This shall reveal all commits betwixt what is currently deployed and thy local HEAD, including commit hashes, messages, and GitHub URLs.

### Staging

Before committing thy changes unto staging, drop a missive in 🔒evergreen-ai-devs to ensure no other soul is presently making use of it.

#### Drone

Drone is capable of [promoting](https://docs.drone.io/promote/) builds opened on PRs to staging. Before commencing, [install and configure the Drone CLI](https://kanopy.corp.mongodb.com/docs/cicd/advanced_drone/#drone-cli).

1. Open a PR with thy changes (a draft shall suffice). This shall set the `publish` step in motion.
2. Survey pending commits using `kcs && pnpm pending-commits` to discern what shall be deployed.
3. Once the build hath concluded, locate the build number upon [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage).
4. Promote the build to staging:
   - **CLI**: Execute `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> staging`
   - **Web UI**: Click `…` > `Promote` upon thy build's page. Inscribe "staging" in the "Target" field and submit.

#### Local

Local deploys are of slower disposition but remain useful in certain circumstances. First install [Rancher Desktop](https://rancherdesktop.io) as thy container manager. Open Rancher and thereafter run `pnpm deploy:staging` from the Sage directory to set the deploy in motion.

Take heed that Drone's [deployments page](https://drone.corp.mongodb.com/evergreen-ci/sage/deployments) shall not reflect local deploys. To verify thy deploy hath been duly propagated, install [Helm](https://kanopy.corp.mongodb.com/docs/configuration/helm/) and run `helm status sage`.

### Production

To deploy unto production, observe the following rites:

1. Survey pending commits: `kcp && pnpm pending-commits`
2. Locate the build upon [Drone](https://drone.corp.mongodb.com/evergreen-ci/sage) for the commit thou wishest to deploy (it must needs reside upon the `main` branch).
3. Promote the build to production:
   - **CLI**: Execute `drone build promote evergreen-ci/sage <DRONE_BUILD_NUMBER> production`
   - **Web UI**: Click `…` > `Promote` upon thy build's page. Inscribe "production" in the "Target" field and submit.

**Nota Bene**: Thou must be promoting a Drone build that hath pushed a commit unto `main`.

### The Manual Execution of Cronjobs

Within the staging environment, the following cronjobs are stayed from automatic execution, lest they interfere with local testing:

- `sage-bot-jira-polling-job` — Polls Jira for new tickets requiring attention
- `cursor-agent-status-polling-job` — Polls Cursor for agent status updates

These cronjobs may yet be invoked by hand using `kubectl` for the purposes of testing.

#### Prerequisites and Preparations

1. Ensure `kubectl` is installed and properly configured upon thy machine
2. Switch to the staging Kubernetes context:
   ```bash
   kcs  # or by hand: kubectl config use-context <staging-context>
   ```

All commands hereafter employ the `-n devprod-evergreen` flag to specify the namespace, thereby avoiding the persistence of namespace changes in thy kubeconfig.

#### Invoking a Cronjob by Hand

To manually trigger a cronjob, employ `kubectl create job` to summon a one-time job from the cronjob:

```bash
# Execute sage-bot-jira-polling-job
kubectl create job --from=cronjob/sage-bot-jira-polling-job sage-bot-jira-polling-job-manual-$(date +%s) -n devprod-evergreen

# Execute cursor-agent-status-polling-job
kubectl create job --from=cronjob/cursor-agent-status-polling-job cursor-agent-status-polling-job-manual-$(date +%s) -n devprod-evergreen
```

The `$(date +%s)` suffix ensurest that each manual execution beareth a unique job name.

#### Observing Job Execution

To examine the status of a manually created job:

```bash
# List recent jobs
kubectl get jobs -n devprod-evergreen

# View job details
kubectl describe job <job-name> -n devprod-evergreen

# View job logs
kubectl logs job/<job-name> -n devprod-evergreen
```

#### The Removal of Manual Jobs

After testing hath concluded, thou mayest delete a specific manual job:

```bash
kubectl delete job <job-name> -n devprod-evergreen
```

Or purge all manual jobs for a specific cronjob:

```bash
# Delete all manual jobs for sage-bot-jira-polling-job
kubectl get jobs -o name -n devprod-evergreen | grep '^job.batch/sage-bot-jira-polling-job-manual-' | xargs kubectl delete -n devprod-evergreen

# Delete all manual jobs for cursor-agent-status-polling-job
kubectl get jobs -o name -n devprod-evergreen | grep '^job.batch/cursor-agent-status-polling-job-manual-' | xargs kubectl delete -n devprod-evergreen
```
