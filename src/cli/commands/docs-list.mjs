/**
 * docs-list — List Google Docs in Drive.
 *
 * Usage:
 *   npx google-mcp docs-list
 *   npx google-mcp docs-list --query "report"
 *   npx google-mcp docs-list --limit 10
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createDriveClientFromConfig } from "../../server/docs-client.mjs";

export async function docsListCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(
      chalk.red("❌ No configuration found. Run `npx google-mcp init` first.")
    );
    process.exit(1);
  }

  const spinner = ora("Listing Google Docs...").start();

  try {
    const drive = createDriveClientFromConfig(config);

    let q = "mimeType='application/vnd.google-apps.document'";
    if (options.query) {
      q += ` and name contains '${options.query.replace(/'/g, "\\'")}'`;
    }

    const res = await drive.files.list({
      q,
      pageSize: options.limit || 20,
      fields: "files(id, name, createdTime, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc",
    });

    spinner.succeed(`Found ${res.data.files?.length || 0} document(s)`);

    if (!res.data.files || res.data.files.length === 0) {
      console.log(chalk.gray("\n  No documents found."));
      return;
    }

    console.log();
    for (const file of res.data.files) {
      console.log(chalk.bold(`  ${file.name}`));
      console.log(chalk.gray(`    ID: ${file.id}`));
      console.log(chalk.gray(`    Modified: ${file.modifiedTime}`));
      console.log(
        chalk.underline.blue(
          `    ${file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`}`
        )
      );
      console.log();
    }
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}
