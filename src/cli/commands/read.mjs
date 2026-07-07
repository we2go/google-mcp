/**
 * read — Read data from a specific sheet.
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createSheetsClientFromConfig } from "../../server/sheets-client.mjs";

export async function readCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red("❌ No configuration found. Run `npx google-mcp init` first."));
    process.exit(1);
  }

  const range = options.range
    ? `${options.sheet}!${options.range}`
    : `${options.sheet}`;

  const spinner = ora(`Reading "${range}"...`).start();

  try {
    const sheets = createSheetsClientFromConfig(config);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const rows = res.data.values || [];
    spinner.succeed(`Read ${rows.length} rows from "${range.split("!")[0]}"`);

    if (rows.length === 0) {
      console.log(chalk.yellow("  (empty sheet)"));
      return;
    }

    if (options.raw) {
      // Raw 2D array
      rows.forEach((row) => {
        console.log(JSON.stringify(row));
      });
    } else {
      // First row = headers, rest = objects
      const [headers, ...data] = rows;
      data.forEach((row) => {
        const obj = {};
        headers.forEach((h, j) => {
          obj[h] = row[j] ?? "";
        });
        console.log(JSON.stringify(obj));
      });
    }

    console.log();
    console.log(chalk.gray(`  Total: ${options.raw ? rows.length : rows.length - 1} data row(s)`));

  } catch (err) {
    spinner.fail(`Failed to read: ${err.message}`);
    process.exit(1);
  }
}
