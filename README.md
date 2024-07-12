# SFOPS Migrator

The SFOPS Migrator is a Node.js script that automates the migration of GitHub repository variables from an old format to a new format. It fetches issue details, creates new variables based on the old variables, and updates the repository with the migrated variables.

## Prerequisites

- Node.js (version 12 or above)
- GitHub access token with appropriate permissions to read issues and manage repository variables
- Repository owner and name

## Installation

You can install the SFOPS Migrator script globally using npm:

```bash
npm install -g sfops-migrator
```

## Usage

To run the SFOPS Migrator script, use the following command:

```bash
sfops-migrator OWNER REPO YOUR_GITHUB_ACCESS_TOKEN
```

Replace the following placeholders:
- `YOUR_GITHUB_ACCESS_TOKEN`: Your GitHub access token with appropriate permissions.
- `OWNER`: The owner of the repository.
- `REPO`: The name of the repository.

Example:
```bash
sfops-migrator my-organization my-repo abc123def456
```

## How It Works

The SFOPS Migrator script performs the following steps:

1. Reads the GitHub access token, repository owner, and repository name from the command-line arguments.
2. Fetches the existing repository variables using the GitHub API.
3. For each variable ending with "_DEVSBX":
   - Parses the old variable value from JSON.
   - Fetches the issue details associated with the old variable using the issue number.
   - Extracts the source sandbox, days to keep, and user email from the issue body using regular expressions.
   - Creates a new variable object based on the old variable and the extracted details.
   - Checks if a variable with the upgraded name already exists in the repository.
   - If the upgraded variable doesn't exist, creates a new variable with the upgraded name and value.
   - If the upgraded variable already exists, skips the creation and logs a message.
4. Logs the progress and status of the migration process using console logs with emojis.

## Console Output

The script provides informative console logs to track the progress and status of the migration process. The console logs include:

- 🚀 Starting SFOPS Migration for the specified owner and repo
- ⚙️ Upgrading variable: [variable name]
- 📝 Issue #[issue number]: [issue title]
- ✅ Fetched issue details for issue #[issue number]
- ⏭️ Variable [variable name] already exists. Skipping...
- ✨ Created new variable: [variable name]
- 🎉 SFOPS Migration completed successfully!

## Error Handling

The script includes basic error handling:

- If the GitHub access token, repository owner, or repository name is not provided as command-line arguments, an error message is logged, and the script exits with a non-zero status code.
- If an error occurs during the API requests or variable creation, the error is thrown and logged.

