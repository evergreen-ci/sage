# Using Sage Bot

This guide explains how to create Jira tickets for Sage Bot and trigger processing.

## Prerequisites

Before using Sage Bot, you must complete the [onboarding steps](./onboarding.md).

## Creating a Jira Ticket

Your Jira ticket must include the following:

| Field                | Required    | Description                                                                                                                                         |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Summary**          | Yes         | A clear title describing the task                                                                                                                   |
| **Description**      | Recommended | Detailed implementation requirements                                                                                                                |
| **Assignee**         | Yes         | Must be set to a user with a Cursor API Key registered with Sage Bot. See the [Onboarding guide](./onboarding.md) to register a user with Sage Bot. |
| **Repository Label** | Yes         | Label in format `repo:<org>/<repo>` or `repo:<org>/<repo>@<branch>`                                                                                 |

### Repository Label Format

The repository label tells Sage Bot which repository to work on.
The label format:

```
repo:<repo_org>/<repo_name>
```

Or with an optional branch:

```
repo:<repo_org>/<repo_name>@<branch_name>
```

If you don't specify a branch, Sage Bot uses the repository's default branch (typically `main` or `master`).

Examples:

- `repo:10gen/mms` - Uses the repository's default branch
- `repo:10gen/mms@my-feature-branch` - Uses a specific branch

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
