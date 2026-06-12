/**
 * init — Interactive setup wizard.
 *
 * Two auth modes:
 *   service-account (default):  JSON key + share sheet
 *   oauth:                      OAuth2 browser flow → refresh token
 *
 * OAuth2 flow:
 *   1. User pastes client_id + client_secret
 *   2. CLI prints auth URL
 *   3. User opens URL, grants access, copies code
 *   4. CLI exchanges code for refresh_token
 *   5. Token auto-refreshes forever
 */

import http from "node:http";
import { URL } from "node:url";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { loadConfig, saveConfig, extractSpreadsheetId } from "../../config/config.mjs";
import {
  createServiceAccountSheetsClient,
  createOAuth2SheetsClient,
} from "../../server/sheets-client.mjs";
import {
  generateAuthUrl,
  exchangeCodeForTokens,
} from "../../server/oauth2-client.mjs";
import { generateIDEConfigs } from "./helpers/generate-ide-configs.mjs";

export async function initCommand(options) {
  const authType = options.auth || "service-account";
  const isOAuth = authType === "oauth";

  const authLabel = isOAuth
    ? "OAuth2 (Personal Google Account)"
    : "Service Account";

  console.log(chalk.bold.cyan(`\n🔗 Google Sheet MCP — Setup Wizard`));
  console.log(chalk.gray(`   Auth mode: ${authLabel}`));
  console.log();

  // Check for existing config
  const existing = loadConfig();
  if (existing) {
    console.log(
      chalk.yellow(
        `⚠️  Already configured (${existing.source}): ${existing.spreadsheetId} (${existing.authType || "service-account"})`
      )
    );
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Overwrite existing configuration?",
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.gray("  Setup cancelled."));
      return;
    }
    console.log();
  }

  // Step 1: Google Sheet URL
  console.log(chalk.bold("Step 1/4: Google Sheet"));
  const { sheetUrl } = await inquirer.prompt([
    {
      type: "input",
      name: "sheetUrl",
      message: "Paste Google Sheet URL:",
      validate: (input) => {
        const id = extractSpreadsheetId(input);
        if (!id)
          return "Invalid Google Sheet URL. Expected: https://docs.google.com/spreadsheets/d/<ID>/edit";
        return true;
      },
    },
  ]);
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  console.log(chalk.green(`  ✅ Extracted ID: ${spreadsheetId}`));
  console.log();

  if (isOAuth) {
    // ─── OAuth2 Flow ──────────────────────────────────────────────────────
    await setupOAuth2(spreadsheetId);
  } else {
    // ─── Service Account Flow (default) ───────────────────────────────────
    await setupServiceAccount(spreadsheetId);
  }
}

/**
 * Service Account setup.
 */
async function setupServiceAccount(spreadsheetId) {
  console.log(chalk.bold("Step 2/4: Service Account Key"));
  console.log(
    chalk.gray("  If you haven't created one yet, see: docs/setup-google.md")
  );
  const { credentialsPath } = await inquirer.prompt([
    {
      type: "input",
      name: "credentialsPath",
      message: "Path to service account JSON key:",
      default: "./credentials.json",
    },
  ]);
  console.log(chalk.green(`  ✅ Credentials: ${credentialsPath}`));
  console.log();

  // Step 3: Verify connection
  console.log(chalk.bold("Step 3/4: Verify connection"));
  const spinner = ora("Connecting to Google Sheets...").start();

  try {
    const sheets = createServiceAccountSheetsClient({ credentialsPath });
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties",
    });

    const title = res.data.properties.title;
    const sheetList = (res.data.sheets ?? []).map(
      (s) => s.properties?.title || "(unnamed)"
    );

    spinner.succeed(`Connected to "${chalk.bold(title)}"`);
    console.log(
      chalk.green(
        `  Found ${sheetList.length} sheet(s): ${sheetList.join(", ")}`
      )
    );
    console.log();

    // Save config
    const configPath = saveConfig({
      spreadsheetId,
      authType: "service-account",
      credentialsPath,
      sheets: sheetList,
    });

    await afterConnectionSuccess(configPath, sheetList);
  } catch (err) {
    spinner.fail(`Connection failed: ${err.message}`);
    printServiceAccountTroubleshooting();
  }
}

/**
 * OAuth2 setup flow.
 */
async function setupOAuth2(spreadsheetId) {
  console.log(chalk.bold("Step 2/4: OAuth2 Credentials"));
  console.log(
    chalk.gray(
      "  Get these from Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Desktop app."
    )
  );

  const { clientId, clientSecret } = await inquirer.prompt([
    {
      type: "input",
      name: "clientId",
      message: "Client ID:",
      validate: (input) =>
        input.length > 10
          ? true
          : "Invalid Client ID. Should be a long string ending with .apps.googleusercontent.com",
    },
    {
      type: "input",
      name: "clientSecret",
      message: "Client Secret:",
      validate: (input) =>
        input.length > 5 ? true : "Invalid Client Secret.",
    },
  ]);

  console.log(chalk.green(`  ✅ Credentials accepted`));
  console.log();

  // Step 3: Browser OAuth flow
  console.log(chalk.bold("Step 3/4: Authorize Access"));

  const authUrl = generateAuthUrl(clientId, clientSecret);
  console.log();
  console.log(
    chalk.white("  1. Open this URL in your browser:")
  );
  console.log(chalk.cyan(`     ${authUrl}`));
  console.log();
  console.log(
    chalk.white(
      "  2. Sign in with your Google account"
    )
  );
  console.log(
    chalk.white(
      "  3. Grant access to Google Sheets"
    )
  );
  console.log(
    chalk.white(
      "  4. You'll be redirected to localhost — copy the 'code' parameter from the URL"
    )
  );
  console.log();

  // Try to auto-capture the code via local HTTP server
  const code = await captureOAuthCode();

  if (!code) {
    // Fallback: manual entry
    const { manualCode } = await inquirer.prompt([
      {
        type: "input",
        name: "manualCode",
        message:
          "Paste the authorization code from the redirect URL (?code=...):",
        validate: (input) =>
          input.length > 5 ? true : "Code seems too short.",
      },
    ]);
    return await completeOAuthSetup(spreadsheetId, clientId, clientSecret, manualCode);
  }

  return await completeOAuthSetup(spreadsheetId, clientId, clientSecret, code);
}

/**
 * Start a local HTTP server to capture the OAuth redirect.
 * Returns the authorization code or null (if user wants manual entry).
 */
function captureOAuthCode() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsed = new URL(req.url, "http://localhost:3000");
      const code = parsed.searchParams.get("code");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 60px;">
            <h1>✅ Authorization Successful</h1>
            <p>You can close this tab and return to the terminal.</p>
          </body>
          </html>
        `);
        server.close();
        resolve(code);
      } else {
        const error = parsed.searchParams.get("error");
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 60px;">
            <h1>❌ Authorization Failed</h1>
            <p>Error: ${error || "unknown"}</p>
          </body>
          </html>
        `);
        server.close();
        resolve(null);
      }
    });

    server.listen(3000, () => {
      console.log(
        chalk.gray("  Waiting for browser redirect on http://localhost:3000 ...")
      );
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      resolve(null);
    }, 120_000);
  });
}

/**
 * Exchange code for tokens and test connection.
 */
async function completeOAuthSetup(spreadsheetId, clientId, clientSecret, code) {
  console.log();
  const exchangeSpinner = ora("Exchanging code for tokens...").start();

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(clientId, clientSecret, code);
    exchangeSpinner.succeed("Tokens obtained");
  } catch (err) {
    exchangeSpinner.fail(`Failed: ${err.message}`);
    console.log(
      chalk.yellow(
        "  The authorization code may have expired. Run the init command again."
      )
    );
    return;
  }

  if (!tokens.refresh_token) {
    console.log(
      chalk.red(
        "  ❌ No refresh token returned. Try again — make sure to approve all permissions."
      )
    );
    return;
  }

  console.log(
    chalk.green(
      `  ✅ Refresh token: ${tokens.refresh_token.substring(0, 12)}...`
    )
  );
  console.log();

  // Step 4: Test connection
  console.log(chalk.bold("Step 4/4: Verify connection"));
  const spinner = ora("Connecting to Google Sheets...").start();

  try {
    const oauth2Config = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
    };

    const sheets = createOAuth2SheetsClient({ oauth2: oauth2Config });
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties",
    });

    const title = res.data.properties.title;
    const sheetList = (res.data.sheets ?? []).map(
      (s) => s.properties?.title || "(unnamed)"
    );

    spinner.succeed(`Connected to "${chalk.bold(title)}" (as you)`);
    console.log(
      chalk.green(
        `  Found ${sheetList.length} sheet(s): ${sheetList.join(", ")}`
      )
    );
    console.log();

    // Save config
    const configPath = saveConfig({
      spreadsheetId,
      authType: "oauth2",
      oauth2: oauth2Config,
      sheets: sheetList,
    });

    await afterConnectionSuccess(configPath, sheetList);
  } catch (err) {
    spinner.fail(`Connection failed: ${err.message}`);
    printOAuthTroubleshooting();
  }
}

/**
 * Shared post-connection step: save config → show summary → generate IDE configs.
 */
async function afterConnectionSuccess(configPath, sheetList) {
  console.log(chalk.green(`✅ Configuration saved to ${configPath}`));
  console.log();

  console.log(chalk.bold("🚀 Connection verified!"));
  console.log();
  console.log("  Test connection:");
  console.log(chalk.cyan("    npx google-sheet-mcp test"));
  console.log();
  console.log("  List sheets:");
  console.log(chalk.cyan("    npx google-sheet-mcp list"));
  console.log();
  console.log("  Read data:");
  console.log(
    chalk.cyan(`    npx google-sheet-mcp read -s "${sheetList[0]}"`)
  );
  console.log();

  // Step 4: Generate IDE MCP configs
  await generateIDEConfigs({ cwd: process.cwd() });
}

function printServiceAccountTroubleshooting() {
  console.log();
  console.log(chalk.yellow("Common issues:"));
  console.log("  1. Did you share the sheet with the service account email?");
  console.log(
    "  2. Is the Sheets API enabled in your Google Cloud project?"
  );
  console.log("  3. Is the JSON key file path correct?");
  console.log();
  console.log(chalk.gray("  Run the command again to retry."));
}

function printOAuthTroubleshooting() {
  console.log();
  console.log(chalk.yellow("Common issues:"));
  console.log("  1. Do you have access to this spreadsheet?");
  console.log("  2. Did you grant the full spreadsheets scope?");
  console.log(
    "  3. Is the Sheets API enabled in your Google Cloud project?"
  );
  console.log("  4. Try running `npx google-sheet-mcp token-status`");
  console.log();
  console.log(chalk.gray("  Run the command again to retry."));
}
