/**
 * token-status — Check OAuth2 refresh token health.
 *
 * Validates the refresh token by attempting to get a fresh access token.
 * Useful for:
 *   - Debugging "access denied" errors
 *   - Checking if token was revoked
 *   - Pre-flight check before CI/CD usage
 */

import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../config/config.mjs";
import {
  validateRefreshToken,
  getTokenInfo,
} from "../../server/oauth2-client.mjs";

export async function tokenStatusCommand() {
  console.log(chalk.bold.cyan("\n🔑 Google Sheet MCP — Token Status\n"));

  const config = loadConfig();
  if (!config) {
    console.error(
      chalk.red(
        "❌ No configuration found. Run `npx google-sheet-mcp init --auth oauth` first."
      )
    );
    process.exit(1);
  }

  console.log(chalk.gray(`  Config source: ${config.source}`));
  console.log(chalk.gray(`  Auth type:     ${config.authType || "service-account"}`));
  console.log();

  if (config.authType !== "oauth2") {
    console.log(
      chalk.yellow(
        "⚠️  Token-status is only relevant for OAuth2 authentication.\n" +
          "   Service accounts use JSON keys that don't expire."
      )
    );
    return;
  }

  // Show stored token info
  const info = getTokenInfo(config.oauth2);
  console.log(chalk.bold("Stored token:"));
  console.log(chalk.white(`  Status:      ${info.status}`));
  if (info.clientId) {
    console.log(chalk.white(`  Client ID:   ${info.clientId}`));
  }
  if (info.refreshTokenPrefix) {
    console.log(
      chalk.white(`  Refresh:     ${info.refreshTokenPrefix}`)
    );
  }
  if (info.issues) {
    for (const issue of info.issues) {
      console.log(chalk.red(`  ❌ ${issue}`));
    }
  }
  console.log();

  if (info.status !== "configured") {
    console.log(
      chalk.red(
        "❌ Token is incomplete. Run `npx google-sheet-mcp init --auth oauth` to reconfigure."
      )
    );
    process.exit(1);
  }

  // Validate by refreshing
  const spinner = ora("Validating refresh token...").start();

  try {
    const result = await validateRefreshToken(config.oauth2);

    if (result.valid) {
      spinner.succeed("Token is valid");
      console.log();
      console.log(chalk.green("✅ Refresh token is healthy"));
      console.log(chalk.gray(`  Access token expires: ${result.expiresAt}`));
      console.log(chalk.gray(`  Scopes: ${result.scopes}`));
      console.log();
      console.log(
        chalk.white(
          "  AI agents can now access your Google Sheets on your behalf."
        )
      );
    } else {
      spinner.fail(`Token is invalid: ${result.error}`);
      console.log();
      console.log(chalk.yellow(`  Hint: ${result.hint}`));
      console.log();
      console.log(
        chalk.white("  To replace the token, run:")
      );
      console.log(
        chalk.cyan("    npx google-sheet-mcp init --auth oauth")
      );
      console.log(
        chalk.gray(
          "    This will walk you through the OAuth flow and save a new refresh token."
        )
      );
      process.exit(1);
    }
  } catch (err) {
    spinner.fail(`Validation error: ${err.message}`);
    process.exit(1);
  }
}
