/**
 * append — Add a row to a sheet.
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createSheetsClient } from "../../server/sheets-client.mjs";

export async function appendCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red("❌ No configuration found. Run `npx google-sheet-mcp init` first."));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(options.data);
  } catch {
    console.error(chalk.red("❌ Invalid JSON for --data. Example: '{\"name\":\"Anton\"}'"));
    process.exit(1);
  }

  const spinner = ora(`Appending to "${options.sheet}"...`).start();

  try {
    // First, get headers to align columns
    const sheets = createSheetsClient(config.credentialsPath);
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${options.sheet}!1:1`,
    });

    const headers = headerRes.data.values?.[0] || Object.keys(data);
    const row = headers.map((h) => data[h] ?? "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${options.sheet}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });

    spinner.succeed(`Row appended to "${options.sheet}"`);
    console.log(chalk.gray(`  ${headers.slice(0, 6).join(" | ")}` + (headers.length > 6 ? "..." : "")));
    console.log(chalk.white(`  ${row.slice(0, 6).join(" | ")}` + (row.length > 6 ? "..." : "")));

  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}
