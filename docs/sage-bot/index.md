# Sage Bot

Some Jira tickets describe straightforward implementation tasks that are well-defined enough for an AI agent to handle — adding a config option, writing a migration, fixing a linter warning. Sage Bot lets you hand these off: create a Jira ticket with a clear description, add the `sage-bot` label, and a Cursor AI agent will generate a PR for you to review.

## Documentation

- [Onboarding Guide](./onboarding.md) — Set up your account to use Sage Bot
- [Usage Guide](./usage.md) — How to create tickets and trigger Sage Bot
- [Adding Jira Projects](./adding-projects.md) — Request access for new Jira projects
- [Adding GitHub Repos](./adding-github-repos.md) — Request Cursor GitHub app installation
- [Troubleshooting](./troubleshooting.md) — Common issues, known limitations, and FAQ

## Quick Start

1. Complete the [onboarding steps](./onboarding.md) (one-time setup)
2. Create a Jira ticket with:
   - **Summary**: Clear title describing the task
   - **Description**: Detailed implementation requirements
   - **Assignee**: A user with registered credentials
   - **Repository label**: `repo:<org>/<repo>` (e.g., `repo:10gen/mms`)
3. Add the `sage-bot` label to trigger processing
4. Review the generated PR

## Supported Projects

Sage Bot monitors Jira projects where its service account has browse, edit, and comment permissions. It currently supports these projects:

- AMP
- BAAS
- CLOUDP
- CRMSUP
- CSHARP
- DEVPROD
- DOCSP
- MANAENG
- MCP
- MHOUSE
- SLS
- TUNE

Need to add support for your project? See the [Adding Jira Projects guide](./adding-projects.md) for instructions.

## Compliance

All users are responsible for following the [MongoDB Policy for Use of AI Coding Tools](https://mongodb.docebosaas.com/learn/courses/662/mongodb-policy-for-use-of-ai-coding-tools). Please be aware that certain restrictions are in place for AI being used in the development of certain products. It is your responsibility to use this tool correctly and within the constraints of the policy.

## Getting Help

If you encounter issues or have questions, check the [troubleshooting guide](./troubleshooting.md) or reach out in [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C0V896UV8).
