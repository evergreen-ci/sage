# Using Sage Bot

This guide explains how to create Jira tickets for Sage Bot and trigger processing.

## Prerequisites

Before using Sage Bot, you must complete the [onboarding steps](./onboarding.md).

## Creating a Jira Ticket

Your Jira ticket must include the following:

| Field                | Required    | Description                                                         |
| -------------------- | ----------- | ------------------------------------------------------------------- |
| **Summary**          | Yes         | A clear title describing the task                                   |
| **Description**      | Recommended | Detailed implementation requirements                                |
| **Assignee**         | Yes         | Must be set to a user with registered credentials                   |
| **Repository Label** | Yes         | Label in format `repo:<org>/<repo>` or `repo:<org>/<repo>@<branch>` |

### Repository Label Format

The repository label tells Sage Bot which repository to work on.
The label format:

```
repo:<repo_org>/<repo_name>@<branch_name>
```

Branch name is optional if you have [configured the repo's default branch](https://github.com/evergreen-ci/sage/blob/main/src/services/repositories/repositories.yaml) for Sage Bot.
If you have not configured the default branch, you must specify the branch name.

For example, for the [10gen/mms](https://github.com/10gen/mms) repo:
- `repo:10gen/mms` - Uses the default branch configured for this repo
- `repo:10gen/mms@my-feature-branch` - Uses a specific branch

### Pre-configured Repositories

Repositories with default branches are configured in [`src/services/repositories/repositories.yaml`](/src/services/repositories/repositories.yaml).

If your repository isn't configured, you have two options:

1. **Specify the branch inline** using the `@branch` syntax (e.g., `repo:myorg/myrepo@main`)
2. **Add your repository to the config** by opening a PR to update `repositories.yaml` - contributions are welcome!

Feel free to reach out to the DevProd team if you have questions.

## Triggering Sage Bot

To trigger Sage Bot on your ticket:

1. Ensure all required fields are filled in
2. Add the label `sage-bot` to your ticket

Sage Bot will:

1. Detect the label and begin processing
2. Remove the `sage-bot` label automatically
3. Post a comment with a link to the Cursor cloud agent session, or an error message if something went wrong
4. Open a pull request when the agent completes successfully

## Retrying Failed Jobs

If a job fails, you can retry by simply adding the `sage-bot` label again.
