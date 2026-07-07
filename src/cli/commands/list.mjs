/**
 * list — Display all sheets in the connected spreadsheet.
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createSheetsClientFromConfig } from "../../server/sheets-client.mjs";

export async function listCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red("❌ No configuration found. Run `npx google-mcp init` first."));
    process.exit(1);
  }

  const spreadsheetId = options.id || options.sheet || config.spreadsheetId;
  if (!spreadsheetId) {
    console.error(
      chalk.red("❌ No spreadsheet ID provided.\n") +
      chalk.gray("  Use -i <id> to specify: npx google-mcp list -i YOUR_SPREADSHEET_ID\n") +
      chalk.gray("  Or run `npx google-mcp init` to set a default.")
    );
    process.exit(1);
  }

  const spinner = ora("Fetching sheets...").start();

  try {
    const sheets = createSheetsClientFromConfig(config);
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties",
    });

    spinner.succeed(`"${res.data.properties.title}"`);
    console.log();

    const sheetList = res.data.sheets ?? [];
    sheetList.forEach((s) => {
      const p = s.properties || {};
      const title = p.title || "(unnamed)";
      const rows = p.gridProperties?.rowCount || "?";
      const cols = p.gridProperties?.columnCount || "?";
      console.log(
        chalk.green(`  📄 ${title}`) +
          chalk.gray(`  ${rows}r × ${cols}c`)
      );
    });

    console.log();
    console.log(chalk.gray(`  Total: ${sheetList.length} sheet(s)`));
    console.log();
    console.log(`  Read data: ${chalk.cyan(`npx google-mcp read -s "${sheetList[0]?.properties?.title || 'Sheet1'}"`)}`);

  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}
