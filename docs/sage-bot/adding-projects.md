# Adding Jira Projects to Sage Bot

This guide explains how to request access for Sage Bot to monitor additional Jira projects.

## Overview

Sage Bot requires read access to Jira projects to monitor tickets and post comments. To add a new project, you'll need to submit a service account change request through IT Productivity.

## Prerequisites

Before submitting a request, you'll need:

- The Jira project key you want to add (e.g., `SERVER`, `CLOUDP`)
- The project administrator's name for approval (find this at `https://jira.mongodb.org/projects/<PROJECT_KEY>` under Administrators)
- Approval from a Sage Bot admin: **Austin Hartschen** or **Mohamed Khelif**

## Step 1: Open the Service Account Change Form

Go to the [Jira Change Service Account form](https://jira.mongodb.org/plugins/servlet/desk/portal/80/create/1271).

## Step 2: Fill Out the Form

Complete the form with the following values:

### Basic Information

| Field                                        | Value                                                               |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Target environment                           | **Production**                                                      |
| Reason for change                            | `Access for Sage Bot to a new project to automate PRs from tickets` |
| Service account to change in Jira Production | **Sage Bot**                                                        |
| Also in Staging?                             | **Yes, do the same in Jira Staging**                                |

### Authentication and Privileges

| Field                        | Value                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| Needs authentication change? | **No change (from current settings)**                      |
| Project Permissions sets     | **Ad-hoc (preferred for PoLP, select single permissions)** |

### Project Access

In the **Projects** table:

| Jira Project(s) | Notes                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| _Your project_  | `I want the bot to be added to this project with its current permissions for other projects.` |

### Permissions to Select

Select the following permissions:

**Project permissions:**

- Browse Projects

**Comments permissions:**

- Add Comments
- Edit Own Comments

**Attachment permissions:**

- Create Attachments

**Issue permissions:**

- Edit Issues

### Approval

| Field                                            | Value                                   |
| ------------------------------------------------ | --------------------------------------- |
| Are you an admin of all the projects you listed? | Select **Yes** or **No** as appropriate |
| Approval of project owners                       | Select the Jira project administrator   |
| Do you want to set a nice-to-have by date?       | Optional                                |

## Step 3: Wait for Approval

The request requires approval from:

1. The Jira project administrator you specified
2. IT Productivity team

## Step 4: Notify Sage Bot Admins

After your IT request is approved, contact a Sage Bot admin (**Austin Hartschen** or **Mohamed Khelif**) to confirm the project has been added and allow them to update the environment variable to enable the new project.

## Need Help?

If you have questions about adding a project, reach out in [#ask-devprod](<(https://mongodb.enterprise.slack.com/archives/C0V896UV8)>).
