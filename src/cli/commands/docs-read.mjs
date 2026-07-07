/**
 * docs-read — Read a Google Doc.
 *
 * Usage:
 *   npx google-mcp docs-read --document <ID>
 *   npx google-mcp docs-read --document <ID> --full
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createDocsClientFromConfig, extractTextFromDoc } from "../../server/docs-client.mjs";

export async function docsReadCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(
      chalk.red("❌ No configuration found. Run `npx google-mcp init` first.")
    );
    process.exit(1);
  }

  const documentId = options.document;
  if (!documentId) {
    console.error(chalk.red("❌ --document <ID> is required."));
    process.exit(1);
  }

  const spinner = ora("Reading document...").start();

  try {
    const docs = createDocsClientFromConfig(config);
    const res = await docs.documents.get({
      documentId,
    });

    spinner.succeed(`Document: "${res.data.title}"`);

    console.log();
    console.log(chalk.bold("  Document ID:"), chalk.cyan(res.data.documentId));
    console.log(chalk.bold("  Title:"), chalk.green(res.data.title));
    console.log(
      chalk.bold("  URL:"),
      chalk.underline.blue(
        `https://docs.google.com/document/d/${res.data.documentId}/edit`
      )
    );

    if (options.full) {
      console.log();
      console.log(chalk.bold("─── Structured Body ───"));
      console.log(JSON.stringify(res.data.body, null, 2));
    } else {
      const text = extractTextFromDoc(res.data);
      console.log();
      console.log(chalk.bold(`─── Content (${text.length} chars) ───`));
      console.log(text || chalk.gray("(empty document)"));
    }

    console.log();
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}
