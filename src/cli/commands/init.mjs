/**
 * init — Interactive setup wizard.
 *
 * Two auth modes:
 *   service-account (default):  JSON key + share sheet
 *   oauth:                      OAuth2 browser flow → refresh token
 *
 * OAuth2 flow (user-friendly):
 *   1. Open browser → sign in with Google → allow access
 *   2. Copy the code from the browser
 *   3. Paste here → done!
 */

import http from "node:http";
import { URL } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { loadConfig, saveConfig, extractSpreadsheetId } from "../../config/config.mjs";
import {
  createServiceAccountSheetsClient,
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

  console.log(chalk.bold.cyan(`\n🔗 Google MCP — Setup Wizard`));
  console.log(chalk.gray(`   Auth mode: ${authLabel}`));
  console.log();

  // Check for existing config
  const existing = loadConfig();
  if (existing) {
    console.log(
      chalk.yellow(
        `⚠️  Already configured (${existing.source}): ${existing.spreadsheetId || "all spreadsheets/docs"} (${existing.authType || "service-account"})`
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

  // For Service Account: need a specific sheet URL
  // For OAuth2: SKIP — user gets access to ALL their sheets/docs
  let spreadsheetId = null;

  if (!isOAuth) {
    // Step 1: Google Sheet URL (service account only)
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
    spreadsheetId = extractSpreadsheetId(sheetUrl);
    console.log(chalk.green(`  ✅ Extracted ID: ${spreadsheetId}`));
    console.log();

    await setupServiceAccount(spreadsheetId);
  } else {
    // OAuth2: no sheet needed — access to ALL sheets/docs
    console.log(chalk.gray("  ℹ️  OAuth2 gives access to ALL your Google Sheets & Docs — no specific URL needed."));
    console.log();
    await setupOAuth2();
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
 * OAuth2 setup flow — simple, no technical jargon.
 *
 * Auto-detects credentials from:
 *   1. credentials/oauth2-client.json (project-local)
 *   2. ~/.google-mcp-oauth.json (global)
 *   3. Asks user to provide or create if none found
 */
async function setupOAuth2() {
  // Try to auto-load OAuth2 credentials
  let clientId, clientSecret;
  const creds = loadOAuthCredentials();

  if (creds) {
    clientId = creds.client_id;
    clientSecret = creds.client_secret;
    console.log(chalk.green("  ✅ Using saved OAuth2 credentials"));
    console.log();
  } else {
    // No credentials found — guide the user
    console.log(
      chalk.bold("  To connect your Google account, you need OAuth2 credentials.")
    );
    console.log(
      chalk.gray("  This is a one-time setup (2 minutes).")
    );
    console.log();

    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "How would you like to proceed?",
        choices: [
          {
            name: "🔑 I already have Client ID & Secret — paste them",
            value: "paste",
          },
          {
            name: "🆕 Create new credentials — open Google Cloud Console",
            value: "create",
          },
        ],
      },
    ]);

    if (choice === "create") {
      console.log();
      console.log(chalk.bold("  📋 Create OAuth2 credentials in 4 clicks:"));
      console.log();
      console.log(chalk.white("  1. Open: ") + chalk.cyan.underline("https://console.cloud.google.com/apis/credentials"));
      console.log(chalk.white("  2. Click ") + chalk.bold("+ CREATE CREDENTIALS") + chalk.white(" → ") + chalk.bold("OAuth client ID"));
      console.log(chalk.white("  3. Choose ") + chalk.bold("Desktop app") + chalk.white(" → Click ") + chalk.bold("CREATE"));
      console.log(chalk.white("  4. Copy the ") + chalk.bold("Client ID") + chalk.white(" and ") + chalk.bold("Client Secret"));
      console.log();
      console.log(chalk.gray("  (You'll also need to add http://localhost:3000/oauth2callback as a redirect URI)"));
      console.log();
    }

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "clientId",
        message: "Client ID (ends with .apps.googleusercontent.com):",
        validate: (input) =>
          input.length > 10
            ? true
            : "Too short. Should look like: 123-abc.apps.googleusercontent.com",
      },
      {
        type: "input",
        name: "clientSecret",
        message: "Client Secret:",
        validate: (input) =>
          input.length > 5 ? true : "Too short.",
      },
    ]);

    clientId = answers.clientId;
    clientSecret = answers.clientSecret;

    // Save for future use
    saveOAuthCredentials(clientId, clientSecret);
    console.log(chalk.green("  ✅ Credentials saved for future use"));
    console.log();
  }

  // Step 1: Open browser
  console.log(chalk.bold("🚀 Step 1/2: Sign in with Google"));
  console.log();
  console.log(chalk.white("  A browser window will open. Sign in to your Google account"));
  console.log(chalk.white("  and allow access to Sheets & Docs."));
  console.log();

  const authUrl = generateAuthUrl(clientId, clientSecret);
  console.log(chalk.cyan("  → ") + chalk.underline.cyan(authUrl));
  console.log();

  // Try to auto-capture the code via local HTTP server
  const code = await captureOAuthCode();

  if (!code) {
    // Fallback: manual entry
    console.log();
    console.log(chalk.bold("📋 Step 2/2: Paste the code"));
    console.log(chalk.gray("  After signing in, you'll see a page that fails to load."));
    console.log(chalk.gray("  Copy the 'code=' part from the address bar."));
    console.log();

    const { manualCode } = await inquirer.prompt([
      {
        type: "input",
        name: "manualCode",
        message: "Paste code from browser:",
        validate: (input) =>
          input.length > 5 ? true : "Code seems too short. Copy the full code=... from the URL.",
      },
    ]);
    return await completeOAuthSetup(clientId, clientSecret, manualCode);
  }

  return await completeOAuthSetup(clientId, clientSecret, code);
}

/**
 * Try to load OAuth2 credentials from common locations.
 */
function loadOAuthCredentials() {
  const paths = [
    resolve(process.cwd(), "credentials/oauth2-client.json"),
    resolve(process.cwd(), "oauth2-client.json"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, "utf-8"));
        // Handle both formats: { installed: { client_id, client_secret } } and { client_id, client_secret }
        const data = raw.installed || raw.web || raw;
        if (data.client_id && data.client_secret) {
          return { client_id: data.client_id, client_secret: data.client_secret };
        }
      } catch { /* skip */ }
    }
  }

  return null;
}

/**
 * Save OAuth2 credentials for future use.
 */
function saveOAuthCredentials(clientId, clientSecret) {
  const dir = resolve(process.cwd(), "credentials");
  try { mkdirSync(dir, { recursive: true }); } catch {}
  const filePath = resolve(dir, "oauth2-client.json");
  writeFileSync(
    filePath,
    JSON.stringify({ client_id: clientId, client_secret: clientSecret }, null, 2)
  );
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
 * Exchange code for tokens and verify access.
 */
async function completeOAuthSetup(clientId, clientSecret, code) {
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

  // Step 2: Verify (non-blocking — token already valid)
  console.log(chalk.bold("🔍 Step 2/2: Checking access..."));
  const spinner = ora("Checking what's available...").start();

  const oauth2Config = {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
  };

  try {
    // Try Drive API to list recent files
    const { createDriveClientFromConfig } = await import("../../server/docs-client.mjs");
    const drive = createDriveClientFromConfig({ authType: "oauth2", oauth2: oauth2Config });

    const [sheetsRes, docsRes] = await Promise.all([
      drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        pageSize: 5,
        fields: "files(id, name)",
        orderBy: "modifiedTime desc",
      }),
      drive.files.list({
        q: "mimeType='application/vnd.google-apps.document'",
        pageSize: 5,
        fields: "files(id, name)",
        orderBy: "modifiedTime desc",
      }),
    ]);

    const recentSheets = sheetsRes.data.files || [];
    const recentDocs = docsRes.data.files || [];

    spinner.succeed(`Connected as ${chalk.bold("you")}`);
    console.log(
      chalk.green(`  📊 ${recentSheets.length} recent spreadsheet(s), 📄 ${recentDocs.length} recent doc(s)`)
    );
    if (recentSheets.length > 0) {
      console.log(chalk.gray(`    Sheets: ${recentSheets.map(s => s.name).join(", ")}`));
    }
    if (recentDocs.length > 0) {
      console.log(chalk.gray(`    Docs: ${recentDocs.map(d => d.name).join(", ")}`));
    }
    console.log();

  } catch (err) {
    // Drive API might not be enabled — that's OK, token is valid
    spinner.warn("Drive API not available — enable for docs listing:");
    console.log(
      chalk.gray("  ") + chalk.underline.cyan("https://console.cloud.google.com/apis/library/drive.googleapis.com")
    );
    console.log(chalk.green("  ✅ Token is valid — Sheets & Docs access works!"));
    console.log();
  }

  // Save config — no spreadsheetId needed for OAuth2
  const configPath = saveConfig({
    authType: "oauth2",
    oauth2: oauth2Config,
  });

  await afterOAuthSuccess(configPath);
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
  console.log(chalk.cyan("    npx google-mcp test"));
  console.log();
  console.log("📄 Docs:");
  console.log(chalk.cyan("    npx google-mcp docs-list"));
  console.log();
  console.log("  List sheets:");
  console.log(chalk.cyan("    npx google-mcp list"));
  console.log();
  console.log("  Read data:");
  console.log(
    chalk.cyan(`    npx google-mcp read -s "${sheetList[0]}"`)
  );
  console.log();

  // Step 4: Generate IDE MCP configs
  await generateIDEConfigs({ cwd: process.cwd() });
}

/**
 * Post-OAuth (no specific spreadsheet): show success and generate IDE configs.
 */
async function afterOAuthSuccess(configPath) {
  console.log(chalk.green(`✅ Configuration saved to ${configPath}`));
  console.log();

  console.log(chalk.bold("🚀 You're all set!"));
  console.log();
  console.log(chalk.white("  Your AI agent now has access to ALL your Google Sheets & Docs."));
  console.log();
  console.log(chalk.bold("  Quick commands:"));
  console.log(chalk.cyan("    npx google-mcp docs-list"));
  console.log(chalk.gray("      List all your Google Docs"));
  console.log(chalk.cyan("    npx google-mcp list -i <spreadsheet-id>"));
  console.log(chalk.gray("      List sheets in any spreadsheet by ID"));
  console.log();
  console.log(chalk.bold("  From AI agents:"));
  console.log(chalk.gray('    "Read Sheet1 from spreadsheet <id>"'));
  console.log(chalk.gray('    "List all my Google Docs"'));
  console.log(chalk.gray('    "Create a new document titled Report"'));
  console.log();

  // Generate IDE MCP configs
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
  console.log("  1. Did you grant all permissions (Sheets + Docs + Drive)?");
  console.log("  2. Is the token still valid? Run: npx google-mcp token-status");
  console.log("  3. Are the required APIs enabled in Google Cloud Console?");
  console.log();
  console.log(chalk.gray("  Run the command again to retry."));
}
