/**
 * docs-create — Create a new Google Doc.
 *
 * Usage:
 *   npx google-mcp docs-create --title "My Document"
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createDocsClientFromConfig } from "../../server/docs-client.mjs";

export async function docsCreateCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(
      chalk.red("❌ No configuration found. Run `npx google-mcp init` first.")
    );
    process.exit(1);
  }

  const title = options.title;
  if (!title) {
    console.error(chalk.red("❌ --title is required."));
    process.exit(1);
  }

  const spinner = ora("Creating Google Doc...").start();

  try {
    const docs = createDocsClientFromConfig(config);
    const res = await docs.documents.create({
      requestBody: { title },
    });

    spinner.succeed("Document created!");

    console.log();
    console.log(chalk.bold("  Document ID:"), chalk.cyan(res.data.documentId));
    console.log(chalk.bold("  Title:"), res.data.title);
    console.log(
      chalk.bold("  URL:"),
      chalk.underline.blue(
        `https://docs.google.com/document/d/${res.data.documentId}/edit`
      )
    );
    console.log();
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}
