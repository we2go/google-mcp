/**
 * create — Create a new sheet tab in the spreadsheet.
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import { createSheetsClient } from "../../server/sheets-client.mjs";

export async function createCommand(options) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red("❌ No configuration found. Run `npx google-sheet-mcp init` first."));
    process.exit(1);
  }

  const spinner = ora(`Creating sheet "${options.sheet}"...`).start();

  try {
    const sheets = createSheetsClient(config.credentialsPath);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: options.sheet,
              },
            },
          },
        ],
      },
    });

    spinner.succeed(`Sheet "${options.sheet}" created`);
    console.log();
    console.log(`  Read it: ${chalk.cyan(`npx google-sheet-mcp read -s "${options.sheet}"`)}`);

  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}
