/**
 * config — Show current configuration.
 */

import chalk from "chalk";
import { loadConfig } from "../../config/config.mjs";

export async function configCommand() {
  const config = loadConfig();
  if (!config) {
    console.log(chalk.yellow("⚠️  No configuration found."));
    console.log();
    console.log("To set up, run:");
    console.log(chalk.cyan("  npx google-sheet-mcp init"));
    console.log();
    console.log("Or set environment variables:");
    console.log(chalk.cyan("  Service Account: GOOGLE_SPREADSHEET_ID + GOOGLE_APPLICATION_CREDENTIALS"));
    console.log(chalk.cyan("  OAuth2:          GOOGLE_SPREADSHEET_ID + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN"));
    return;
  }

  const authType = config.authType || "service-account";

  console.log(chalk.bold.cyan("\n⚙️  Current Configuration\n"));
  console.log(chalk.gray(`  Source:          ${config.source}`));
  if (config._path) {
    console.log(chalk.gray(`  Config file:     ${config._path}`));
  }
  console.log(chalk.white(`  Spreadsheet ID:  ${config.spreadsheetId}`));
  console.log(chalk.white(`  Auth type:       ${authType}`));

  if (authType === "oauth2" && config.oauth2) {
    console.log(
      chalk.white(
        `  Client ID:       ${config.oauth2.client_id?.substring(0, 16)}...`
      )
    );
    console.log(
      chalk.gray(`  Refresh token:   ${config.oauth2.refresh_token?.substring(0, 12)}...`)
    );
    console.log();
    console.log(chalk.gray("  Token health:"));
    console.log(chalk.cyan("    npx google-sheet-mcp token-status"));
  } else {
    console.log(chalk.white(`  Key file:        ${config.credentialsPath}`));
  }

  if (config.sheets && config.sheets.length > 0) {
    console.log(chalk.white(`  Known sheets:    ${config.sheets.join(", ")}`));
  }
  console.log();

  // MCP config hint
  console.log(chalk.bold("MCP Configuration for AI IDEs:"));
  console.log();
  console.log(chalk.gray("  Add this to your MCP config:"));
  console.log();

  if (authType === "oauth2") {
    console.log(
      chalk.white(`  {
    "mcpServers": {
      "google-sheets": {
        "command": "npx",
        "args": ["google-sheet-mcp"],
        "env": {
          "GOOGLE_SPREADSHEET_ID": "${config.spreadsheetId}",
          "GOOGLE_CLIENT_ID": "${config.oauth2?.client_id}",
          "GOOGLE_CLIENT_SECRET": "${config.oauth2?.client_secret}",
          "GOOGLE_REFRESH_TOKEN": "${config.oauth2?.refresh_token}"
        }
      }
    }
  }`)
    );
  } else {
    console.log(
      chalk.white(`  {
    "mcpServers": {
      "google-sheets": {
        "command": "npx",
        "args": ["google-sheet-mcp"],
        "env": {
          "GOOGLE_SPREADSHEET_ID": "${config.spreadsheetId}",
          "GOOGLE_APPLICATION_CREDENTIALS": "${config.credentialsPath}"
        }
      }
    }
  }`)
    );
  }
  console.log();
}
