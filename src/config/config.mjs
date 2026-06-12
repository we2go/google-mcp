/**
 * Configuration management.
 *
 * Supports two auth types:
 *   1. Service Account:  GOOGLE_SPREADSHEET_ID + GOOGLE_APPLICATION_CREDENTIALS
 *   2. OAuth2:           GOOGLE_SPREADSHEET_ID + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN
 *
 * Resolution order:
 *   1. ENV vars
 *   2. .google-sheet-mcp.json in CWD
 *   3. ~/.google-sheet-mcp.json (global)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

const CONFIG_FILENAME = ".google-sheet-mcp.json";

/**
 * Detect auth type from env vars.
 */
function detectAuthFromEnv() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) return null;

  // Service account
  const saCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saCreds) {
    return {
      spreadsheetId,
      authType: "service-account",
      credentialsPath: saCreds,
      source: "env",
    };
  }

  // OAuth2
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    return {
      spreadsheetId,
      authType: "oauth2",
      oauth2: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      },
      source: "env",
    };
  }

  return null;
}

/**
 * Validate a config object has all required fields.
 */
function isValidConfig(config) {
  if (!config || !config.spreadsheetId) return false;

  if (config.authType === "service-account") {
    return !!config.credentialsPath;
  }

  if (config.authType === "oauth2") {
    return !!(
      config.oauth2?.client_id &&
      config.oauth2?.client_secret &&
      config.oauth2?.refresh_token
    );
  }

  return false;
}

/**
 * Load config from local file, global file, or env vars.
 */
export function loadConfig() {
  // 1. ENV vars — highest priority
  const envConfig = detectAuthFromEnv();
  if (envConfig) return envConfig;

  // 2. Local config (.google-sheet-mcp.json in CWD)
  const localPath = resolve(process.cwd(), CONFIG_FILENAME);
  if (existsSync(localPath)) {
    const config = JSON.parse(readFileSync(localPath, "utf-8"));
    if (isValidConfig(config)) {
      config._path = localPath;
      config.source = "local";
      return config;
    }
  }

  // 3. Global config (~/.google-sheet-mcp.json)
  const globalPath = join(homedir(), CONFIG_FILENAME);
  if (existsSync(globalPath)) {
    const config = JSON.parse(readFileSync(globalPath, "utf-8"));
    if (isValidConfig(config)) {
      config._path = globalPath;
      config.source = "global";
      return config;
    }
  }

  return null;
}

/**
 * Save config to local file (CWD) or global (~/).
 *
 * Config shape:
 *   Service Account: { spreadsheetId, authType: "service-account", credentialsPath, sheets }
 *   OAuth2:          { spreadsheetId, authType: "oauth2", oauth2: { client_id, client_secret, refresh_token }, sheets }
 */
export function saveConfig(
  { spreadsheetId, authType, credentialsPath, oauth2, sheets },
  global = false
) {
  const configPath = global
    ? join(homedir(), CONFIG_FILENAME)
    : resolve(process.cwd(), CONFIG_FILENAME);

  const existing = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, "utf-8"))
    : {};

  const config = {
    ...existing,
    spreadsheetId,
    authType: authType || existing.authType || "service-account",
    sheets: sheets || existing.sheets || [],
  };

  if (authType === "oauth2" || existing.authType === "oauth2") {
    config.oauth2 = oauth2 || existing.oauth2 || {};
    delete config.credentialsPath;
  } else {
    config.credentialsPath = credentialsPath || existing.credentialsPath;
    delete config.oauth2;
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  return configPath;
}

/**
 * Extract spreadsheetId from Google Sheets URL.
 */
export function extractSpreadsheetId(url) {
  // Formats:
  // https://docs.google.com/spreadsheets/d/<ID>/edit
  // https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
  const match = url.match(
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
  );
  if (match) return match[1];

  // Maybe it's already a raw ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;

  return null;
}
