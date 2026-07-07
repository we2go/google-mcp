/**
 * Google Sheets client — dual auth: service account + OAuth2.
 *
 * Service Account: uses JSON key file (GOOGLE_APPLICATION_CREDENTIALS).
 * OAuth2:          uses refresh token (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN).
 *
 * Auto-refresh: OAuth2 access tokens are refreshed transparently by googleapis.
 */

import { google } from "googleapis";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createOAuth2Client } from "./oauth2-client.mjs";

let _sheetsClient = null;

/**
 * Create sheets client from loaded config.
 * Detects auth type automatically.
 */
export function createSheetsClientFromConfig(config) {
  const { authType } = config;

  if (authType === "oauth2") {
    return createOAuth2SheetsClient(config);
  }

  // Default: service account
  return createServiceAccountSheetsClient(config);
}

/**
 * Service Account: create authenticated Google Sheets client from JSON key path.
 */
export function createServiceAccountSheetsClient(config) {
  const credentialsPath = config.credentialsPath;
  if (!credentialsPath) {
    throw new Error(
      "No credentials path. Use GOOGLE_APPLICATION_CREDENTIALS or `npx google-mcp init`."
    );
  }

  const resolvedPath = resolve(credentialsPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(
      `Credentials file not found: ${resolvedPath}\n` +
        `Get one from Google Cloud Console → APIs & Services → Credentials → Create Service Account → JSON key.`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: resolvedPath,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * OAuth2: create authenticated Google Sheets client from refresh token.
 * Access token is auto-refreshed by googleapis.
 */
export function createOAuth2SheetsClient(config) {
  const { oauth2 } = config;
  if (!oauth2 || !oauth2.client_id || !oauth2.client_secret || !oauth2.refresh_token) {
    throw new Error(
      "Missing OAuth2 credentials. Run `npx google-mcp init --auth oauth` to configure."
    );
  }

  const auth = createOAuth2Client(oauth2);
  return google.sheets({ version: "v4", auth });
}

/**
 * Backward-compatible: createSheetsClient(credentialsPath).
 * Used by CLI commands that take a direct path.
 */
export function createSheetsClient(credentialsPath) {
  return createServiceAccountSheetsClient({ credentialsPath });
}

/**
 * Get or create cached client.
 */
let _cachedConfig = null;

export function getSheetsClient(configOrPath) {
  if (_sheetsClient) return _sheetsClient;

  if (typeof configOrPath === "string") {
    _sheetsClient = createSheetsClient(configOrPath);
  } else if (configOrPath) {
    _sheetsClient = createSheetsClientFromConfig(configOrPath);
  }

  return _sheetsClient;
}

/**
 * Reset cached client (for switching auth).
 */
export function resetClient() {
  _sheetsClient = null;
  _cachedConfig = null;
}
