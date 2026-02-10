# Sage Bot

Sage Bot automatically generates pull requests from Jira tickets using Cursor's AI agent. Simply create a Jira ticket with the right fields, add a label, and Sage Bot will create a PR for you.

## Documentation

- [Onboarding Guide](./onboarding.md) - Set up your account to use Sage Bot
- [Usage Guide](./usage.md) - How to create tickets and trigger Sage Bot
- [Adding Jira Projects](./adding-projects.md) - Request access for new Jira projects
- [Adding GitHub Repos](./adding-github-repos.md) - Request Cursor GitHub app installation
- [Troubleshooting](./troubleshooting.md) - Common issues, known limitations, and FAQ

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

Sage Bot currently monitors the following Jira projects:

- DEVPROD
- CLOUDP
- AMP
- DOCSP

Want to add support for another project? See the [Adding Jira Projects guide](./adding-projects.md) for instructions.

## Compliance

All users are responsible for following the [MongoDB Policy for Use of AI Coding Tools](https://mongodb.docebosaas.com/learn/courses/662/mongodb-policy-for-use-of-ai-coding-tools). Please be aware that certain restrictions are in place for AI being used in the development of certain products. It is your responsibility to use this tool correctly and within the constraints of the policy.

## Getting Help

If you encounter issues or have questions, check the [troubleshooting guide](./troubleshooting.md) or reach out in [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C0V896UV8).
