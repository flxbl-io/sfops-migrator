#!/usr/bin/env node

const { Octokit } = require("octokit");

async function getIssueDetails(octokit, owner, repo, issueNumber) {
  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  console.log(`📝 Issue #${issueNumber}: ${issue.title}`);
  const sourceSandboxMatch = issue.body.match(
    /### Pick a source sandbox to refresh from\n+(.*)$/m
  );
  const sourceSandbox = sourceSandboxMatch ? sourceSandboxMatch[1].trim() : "";

  const daysToKeepMatch = issue.body.match(
    /### How long should the sandbox be kept\?\n+(.*)$/m
  );
  const daysToKeep = daysToKeepMatch ? daysToKeepMatch[1].trim() : "15"; // Set default to "15"

  const userEmailMatch = issue.body.match(
    /### Email of the user to which this sandbox should be assigned\n+(.*)$/m
  );
  const userEmail = userEmailMatch ? userEmailMatch[1].trim() : "";

  return { sourceSandbox, daysToKeep, userEmail };
}

async function deleteRepositoryVariable(octokit, repoOwner, repoName, name) {
  await octokit.request('DELETE /repos/{owner}/{repo}/actions/variables/{name}', {
    owner: repoOwner,
    repo: repoName,
    name: name,
    headers: { 'X-GitHub-Api-Version': '2022-11-28' },
  });
}

async function getRepoVariables(octokit, owner, repo) {
  const variables = await octokit.paginate(
    "GET /repos/{owner}/{repo}/actions/variables",
    {
      owner: owner,
      repo: repo,
      per_page: 30,
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    }
  );

  return variables;
}

async function updateIssueWithSpecialString(octokit, owner, repo, issueNumber, sourceSandbox, daysToKeep, userEmail) {
  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const specialString = `<!-- {"id":"request-dev-sandbox","sourceSB":"${sourceSandbox}","daysToKeep":"${daysToKeep}","email":"${userEmail}"} -->`;
  const updatedBody = `${issue.body}\n\n${specialString}`;

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: updatedBody,
  });

  console.log(`✏️ Updated issue #${issueNumber} with special string`);
}

function createNewVariable(
  owner,
  repo,
  oldVariable,
  sourceSandbox,
  daysToKeep,
  userEmail
) {
  const createdAt = oldVariable.createdAt;
  const expiry = parseInt(oldVariable.expiry, 10);
  const jobToBeExecutedAfter = Math.floor(
    (createdAt + expiry * 24 * 60 * 60 * 1000 - Date.now()) / (60 * 1000)
  );

  const newVariable = {
    status: "Awaiting",
    payload: {
      id: `request-dev-sandbox`,
      sourceSB: sourceSandbox,
      daysToKeep: daysToKeep,
      email: userEmail,
      issueNumber: oldVariable.issueNumber,
      repoOwner: owner,
      repoName: repo,
      issueCreator: oldVariable.requester,
      valid_issue: "true",
      env: "devhub",
      status: oldVariable.status,
      sandboxName: oldVariable.name,
      devHubAuthRequired: true,
      jobId: "dev-sandbox-expiry",
      username: `${userEmail}.${oldVariable.name}`,
      jobToBeExecutedAfter: jobToBeExecutedAfter,
    },
  };

  return newVariable;
}

async function upgradeVariables(owner, repo, githubToken) {
  const octokit = new Octokit({
    auth: githubToken,
  });

  console.log(`🚀 Starting SFOPS Migration for ${owner}/${repo}`);
  console.log(`---------------------------------------------------`);

  const variables = await getRepoVariables(octokit, owner, repo);

  for (const variable of variables) {
    if (variable.name.endsWith("_DEVSBX")) {
      console.log();
      console.log(`⚙️ Upgrading variable: ${variable.name}`);
      const oldVariable = JSON.parse(variable.value);
      const { sourceSandbox, daysToKeep, userEmail } = await getIssueDetails(
        octokit,
        owner,
        repo,
        oldVariable.issueNumber
      );

      console.log(`✅ Fetched issue details for issue #${oldVariable.issueNumber}`);

      // Update the issue with the special string
      await updateIssueWithSpecialString(octokit, owner, repo, oldVariable.issueNumber, sourceSandbox, daysToKeep, userEmail);

      const newVariable = createNewVariable(
        owner,
        repo,
        oldVariable,
        sourceSandbox,
        daysToKeep,
        userEmail
      );

      const upgradedVariableName = `CONTEXT_${oldVariable.issueNumber}`;

      try {
        await octokit.rest.actions.getRepoVariable({
          owner: owner,
          repo: repo,
          name: upgradedVariableName,
        });

        console.log(
          `⏭️ Variable ${upgradedVariableName} already exists. Skipping...`
        );
      } catch (error) {
        if (error.status === 404) {
          // Variable doesn't exist, create it
          await octokit.rest.actions.createRepoVariable({
            owner: owner,
            repo: repo,
            name: upgradedVariableName,
            value: JSON.stringify(newVariable),
          });

          console.log(
            `✨ Created new variable: ${upgradedVariableName}`
          );
          
          // Delete the old variable
          await deleteRepositoryVariable(octokit, owner, repo, variable.name);
          
          console.log(
            `🗑️ Deleted old variable: ${variable.name}`
          );
        } else {
          throw error;
        }
      }
    }
  }

  console.log();
  console.log(`🎉 SFOPS Migration completed successfully!`);
}

async function main() {
  const [, , owner, repo, githubToken] = process.argv;
  if (!githubToken || !owner || !repo) {
    console.error(
      "Please provide a GitHub access token, owner, and repo as command-line arguments."
    );
    process.exit(1);
  }

  try {
    await upgradeVariables(owner, repo, githubToken);
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
}

main();