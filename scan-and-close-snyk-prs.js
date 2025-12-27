const { Octokit } = require("@octokit/rest");
const dotenv = require("dotenv");
const fs = require("fs");
const readline = require("readline");
const path = require("path");

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_FILE = path.join(__dirname, "repo.json");
const CSV_FILE = path.join(__dirname, "snyk-prs-report.csv");

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function getAllOpenPRs(owner, repo) {
  try {
    const prs = [];
    let page = 1;

    while (true) {
      const { data } = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
        per_page: 100,
        page,
      });

      if (data.length === 0) break;

      prs.push(...data);
      page++;
    }

    return prs;
  } catch (error) {
    console.error(`Error fetching PRs for ${owner}/${repo}:`, error.message);
    return [];
  }
}

function isSnykPR(pr) {
  const title = pr.title.toLowerCase();
  const username = pr.user.login.toLowerCase();
  
  return (
    title.includes("snyk") ||
    title.includes("[snyk]") ||
    username === "snyk-bot" ||
    username.includes("snyk")
  );
}

async function closePR(owner, repo, prNumber, reason) {
  try {
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      state: "closed",
    });

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: reason,
    });

    console.log(`✓ Closed PR #${prNumber} in ${owner}/${repo}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to close PR #${prNumber} in ${owner}/${repo}:`, error.message);
    return false;
  }
}

function generateCSV(snykPRs) {
  const headers = [
    "Repository",
    "Owner",
    "PR Number",
    "PR Title",
    "Author",
    "Created Date",
    "Updated Date",
    "PR URL",
  ];

  const rows = snykPRs.map((item) => [
    item.repo,
    item.owner,
    item.pr.number,
    `"${item.pr.title.replace(/"/g, '""')}"`, // Escape quotes in CSV
    item.pr.user.login,
    item.pr.created_at,
    item.pr.updated_at,
    item.pr.html_url,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  fs.writeFileSync(CSV_FILE, csvContent, "utf8");
  console.log(`\n✓ CSV report generated: ${CSV_FILE}`);
}

async function run() {
  console.log("=".repeat(60));
  console.log("SNYK PR SCANNER & CLOSER");
  console.log("=".repeat(60));

  // Step 1: Read repo.json
  console.log("\n[1/4] Reading repository configuration...");
  let repoConfig;
  try {
    const repoData = fs.readFileSync(REPO_FILE, "utf8");
    repoConfig = JSON.parse(repoData);
    console.log(`✓ Found ${Object.keys(repoConfig).length} repositories in config`);
  } catch (error) {
    console.error(`✗ Error reading ${REPO_FILE}:`, error.message);
    process.exit(1);
  }

  // Step 2: Scan all repos for Snyk PRs
  console.log("\n[2/4] Scanning repositories for Snyk PRs...");
  const allSnykPRs = [];

  for (const [repoKey, repoInfo] of Object.entries(repoConfig)) {
    const { owner, repoName } = repoInfo.github;
    console.log(`\n  Checking ${owner}/${repoName}...`);

    const prs = await getAllOpenPRs(owner, repoName);
    
    if (prs.length === 0) {
      console.log(`    No open PRs found`);
      continue;
    }

    const snykPRs = prs.filter(isSnykPR);
    
    if (snykPRs.length === 0) {
      console.log(`    Found ${prs.length} open PR(s), but no Snyk PRs`);
      continue;
    }

    console.log(`    Found ${snykPRs.length} Snyk PR(s) out of ${prs.length} open PR(s)`);
    
    snykPRs.forEach((pr) => {
      console.log(`      - PR #${pr.number}: ${pr.title}`);
      allSnykPRs.push({
        owner,
        repo: repoName,
        pr,
      });
    });

    // Add a small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Step 3: Generate CSV
  console.log("\n[3/4] Generating CSV report...");
  if (allSnykPRs.length === 0) {
    console.log("✓ No Snyk PRs found across all repositories");
    rl.close();
    return;
  }

  generateCSV(allSnykPRs);
  
  console.log("\n" + "=".repeat(60));
  console.log(`SUMMARY: Found ${allSnykPRs.length} Snyk PR(s) to close`);
  console.log("=".repeat(60));

  // Display summary table
  console.log("\nSnyk PRs by repository:");
  const repoSummary = {};
  allSnykPRs.forEach((item) => {
    const repoKey = `${item.owner}/${item.repo}`;
    repoSummary[repoKey] = (repoSummary[repoKey] || 0) + 1;
  });
  
  Object.entries(repoSummary).forEach(([repo, count]) => {
    console.log(`  ${repo}: ${count} PR(s)`);
  });

  // Step 4: Ask for confirmation
  console.log("\n[4/4] Confirmation required to close PRs");
  console.log(`\nYou are about to close ${allSnykPRs.length} Snyk PR(s).`);
  console.log(`CSV report has been saved to: ${CSV_FILE}`);
  
  const answer = await askQuestion("\nDo you want to proceed with closing these PRs? (yes/no): ");

  if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
    console.log("\n" + "=".repeat(60));
    console.log("CLOSING SNYK PRs");
    console.log("=".repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (const item of allSnykPRs) {
      const success = await closePR(
        item.owner,
        item.repo,
        item.pr.number,
        "Closing this Snyk PR as it is no longer required. This PR was automatically closed as part of a cleanup process."
      );

      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("\n" + "=".repeat(60));
    console.log("COMPLETED");
    console.log("=".repeat(60));
    console.log(`✓ Successfully closed: ${successCount} PR(s)`);
    if (failCount > 0) {
      console.log(`✗ Failed to close: ${failCount} PR(s)`);
    }
  } else {
    console.log("\n✓ Operation cancelled. No PRs were closed.");
    console.log(`CSV report is available at: ${CSV_FILE}`);
  }

  rl.close();
}

// Handle errors and cleanup
process.on("unhandledRejection", (error) => {
  console.error("Unhandled error:", error);
  rl.close();
  process.exit(1);
});

run().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});

