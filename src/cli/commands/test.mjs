/**
 * test — Verify connection to the configured sheet.
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createSheetsClientFromConfig } from "../../server/sheets-client.mjs";

export async function testCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(
      chalk.red(
        "❌ No configuration found.\n" +
          '   Run "npx google-sheet-mcp init" first, or set env vars:\n' +
          "   Service Account: GOOGLE_SPREADSHEET_ID + GOOGLE_APPLICATION_CREDENTIALS\n" +
          "   OAuth2:          GOOGLE_SPREADSHEET_ID + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN"
      )
    );
    process.exit(1);
  }

  console.log(chalk.bold.cyan("\n🔗 Google Sheet MCP — Connection Test\n"));
  console.log(chalk.gray(`  Config source: ${config.source}`));
  console.log(chalk.gray(`  Spreadsheet ID: ${config.spreadsheetId}`));
  console.log(chalk.gray(`  Auth type:     ${config.authType || "service-account"}`));
  if (config.authType === "service-account") {
    console.log(chalk.gray(`  Key file:      ${config.credentialsPath}`));
  } else {
    console.log(chalk.gray(`  Client ID:     ${config.oauth2?.client_id?.substring(0, 16)}...`));
  }
  console.log();

  const spinner = ora("Testing connection...").start();

  try {
    const sheets = createSheetsClientFromConfig(config);
    const res = await sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
      fields: "properties.title,sheets.properties",
    });

    const title = res.data.properties.title;
    const sheetList = (res.data.sheets ?? []).map(
      (s) => ({
        title: s.properties?.title || "(unnamed)",
        rows: s.properties?.gridProperties?.rowCount,
        cols: s.properties?.gridProperties?.columnCount,
      })
    );

    spinner.succeed(`Connected to "${chalk.bold(title)}"`);
    console.log();

    // If --sheet option, try reading it
    if (options.sheet) {
      const readSpinner = ora(`Reading sheet "${options.sheet}"...`).start();
      try {
        const data = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: `${options.sheet}!A1:Z5`,
        });
        const rows = data.data.values || [];
        readSpinner.succeed(`Read ${rows.length} rows from "${options.sheet}"`);
        console.log();
        console.log(chalk.bold("  Preview:"));
        rows.slice(0, 5).forEach((row, i) => {
          console.log(chalk.gray(`  ${i === 0 ? "→" : " "} ${row.slice(0, 6).join(" | ")}`));
        });
      } catch (e) {
        readSpinner.fail(`Cannot read "${options.sheet}": ${e.message}`);
      }
    } else {
      // List all sheets
      console.log(chalk.bold("Sheets:"));
      sheetList.forEach((s) => {
        console.log(chalk.green(`  ✓ ${s.title}`) + chalk.gray(`  (${s.rows} rows × ${s.cols} cols)`));
      });
    }

    console.log();
    console.log(chalk.green("✅ Connection OK — ready to use from AI agents!"));

  } catch (err) {
    spinner.fail(`Connection failed: ${err.message}`);
    console.log();
    console.log(chalk.yellow("Troubleshooting:"));
    if (config.authType === "oauth2") {
      console.log("  1. Run: npx google-sheet-mcp token-status  (check token health)");
      console.log("  2. Re-run: npx google-sheet-mcp init --auth oauth  (replace token)");
    } else {
      console.log("  1. Is the service account email added as Editor on the sheet?");
      console.log("  2. Is the Sheets API enabled?");
    }
    console.log("  3. Run: npx google-sheet-mcp config  (to verify settings)");
    process.exit(1);
  }
}
