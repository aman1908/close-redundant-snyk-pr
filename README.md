# Close Redundant Snyk PRs

A Node.js tool to scan GitHub repositories for Snyk PRs, generate a CSV report, and optionally close them with confirmation.

## Features

- Scans all repositories defined in `repo.json`
- Identifies all open Snyk PRs across multiple repos
- Generates a detailed CSV report with PR information
- Asks for confirmation before closing any PRs
- Includes rate limiting protection
- Adds a comment to each closed PR explaining why it was closed

## Prerequisites

- Node.js (v14 or higher)
- GitHub Personal Access Token with `repo` scope

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Add your GitHub token to the `.env` file:
```
GITHUB_TOKEN=your_github_token_here
```

To create a GitHub token:
- Go to https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Select the `repo` scope (Full control of private repositories)
- Copy the token and paste it in your `.env` file

## Usage

### Scan and Close Snyk PRs (Recommended)

This command will:
1. Read all repositories from `repo.json`
2. Scan each repository for open Snyk PRs
3. Generate a CSV report (`snyk-prs-report.csv`)
4. Display a summary
5. Ask for your confirmation before closing any PRs

```bash
npm run scan-snyk-prs
```


## Configuration

### repo.json

This file contains all the repositories to scan. Each repository entry follows this format:

```json
{
  "repo-name": {
    "npm": "@namespace/package-name",
    "github": {
      "owner": "organization-name",
      "repoName": "repository-name"
    }
  }
}
```

## Output

### CSV Report

The script generates a `snyk-prs-report.csv` file with the following columns:

- **Repository**: Repository name
- **Owner**: GitHub organization/user
- **PR Number**: Pull request number
- **PR Title**: Title of the PR
- **Author**: PR author username
- **Created Date**: When the PR was created
- **Updated Date**: Last update timestamp
- **PR URL**: Direct link to the PR

### Console Output

The script provides detailed console output showing:
- Number of repositories scanned
- PRs found in each repository
- Summary of Snyk PRs by repository
- Confirmation prompt
- Results of closing operations (if confirmed)

## Safety Features

- **Confirmation Required**: The script will never close PRs without explicit user confirmation
- **CSV Export**: Always generates a CSV file for review before any action
- **Rate Limiting**: Includes delays between API calls to avoid GitHub rate limits
- **Error Handling**: Gracefully handles errors and continues with other repositories

## Snyk PR Detection

The script identifies Snyk PRs by checking if:
- PR title contains "snyk" (case-insensitive)
- PR title contains "[snyk]"
- PR author username is "snyk-bot"
- PR author username contains "snyk"

## Example Output

```
============================================================
SNYK PR SCANNER & CLOSER
============================================================

[1/4] Reading repository configuration...
✓ Found 16 repositories in config

[2/4] Scanning repositories for Snyk PRs...

  Checking contentstack/cli...
    Found 2 Snyk PR(s) out of 5 open PR(s)
      - PR #123: [Snyk] Security upgrade axios from 0.21.1 to 0.21.2
      - PR #125: [Snyk] Fix for 3 vulnerabilities

[3/4] Generating CSV report...
✓ CSV report generated: /path/to/snyk-prs-report.csv

============================================================
SUMMARY: Found 2 Snyk PR(s) to close
============================================================

Snyk PRs by repository:
  contentstack/cli: 2 PR(s)

[4/4] Confirmation required to close PRs

You are about to close 2 Snyk PR(s).
CSV report has been saved to: /path/to/snyk-prs-report.csv

Do you want to proceed with closing these PRs? (yes/no):
```

