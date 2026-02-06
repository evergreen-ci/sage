# Adding GitHub Repositories to Sage Bot

This guide explains how to request the Cursor GitHub app be installed on a repository so Sage Bot can create pull requests.

## Overview

Sage Bot uses Cursor's cloud agent to generate code and create pull requests. For this to work, the Cursor GitHub app must be installed on the target repository.

## Prerequisites

Before submitting a request, you'll need:

- The GitHub organization and repository name (e.g., `10gen/mms`)
- Permission to request app installations for the repository

## Step 1: Open the IT Request Form

Go to the [IT Service Request form](https://help-it.mongodb.com/hc/en-us/requests/new?ticket_form_id=11872020855315).

## Step 2: Fill Out the Form

Complete the form with the following values:

**Basic Information:**

- **Please choose a form below:** Submit IT Request
- **Subject:** `Install Cursor GitHub App in <org>/<repo>`
- **Priority:** Normal
- **Let us know more about your request:** Accounts & Access
- **Choose the type of issue or access...:** Service Account
- **Please select the category of service account you need:** GitHub -> App / OAuth Credentials

**Service Account Details:**

- **Please describe the purpose of your service account:** `Install the Cursor GitHub App to enable Sage Bot automated PR generation`
- **Which specific system will the credentials be stored in?:** `N/A`
- **What department manages this system?:** `N/A`
- **How many people will have access to the service account credentials?:** `N/A - this is a GitHub App installation, not credentials`
- **How will the service account credentials be protected?:** `N/A - this is a GitHub App installation, not credentials`

**Description:**

In the Description field, provide details about the request:

> Can you please install the Cursor App (<https://github.com/apps/cursor>) in `<org>/<repo>`?

## Step 3: Wait for Approval

The IT team will process your request and install the Cursor GitHub app on the specified repository. The request may be escalated to the Identity and Access Management team.

## Step 4: Connect Your Cursor Account

Once the app is installed on the repository, you'll need to connect it to your Cursor account:

1. Go to **Integrations** in the [Cursor Dashboard](https://cursor.com/settings)
2. Click **Connect** next to GitHub
3. Choose **Selected repositories** and add the new repository (or **All repositories** if preferred)

## Need Help?

If you have questions about adding a repository, reach out in [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C0V896UV8).
