/**
 * OAuth2 Google client — shared by Sheets + Docs.
 *
 * Uses refresh token — no browser login needed after initial setup.
 * Token auto-refreshes via googleapis library.
 *
 * Scopes: spreadsheets + documents + drive.readonly (for listing).
 *
 * Setup flow (one-time):
 *   1. Create OAuth2 credentials in Google Cloud Console
 *   2. Run `npx google-mcp init --auth oauth`
 *   3. Follow browser OAuth flow
 *   4. Refresh token is saved and auto-refreshed forever
 *
 * Token health:
 *   - `npx google-mcp token-status` — check if token is valid
 *   - Invalid token → run `npx google-mcp init --auth oauth` again
 */

import { google } from "googleapis";

// ─── Unified OAuth2 scopes for Sheets + Docs ─────────────────────────────────

export const ALL_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.readonly",
];

/**
 * Create OAuth2 client from stored refresh token.
 * Automatically refreshes access token if expired.
 */
export function createOAuth2Client(credentials) {
  const { client_id, client_secret, refresh_token } = credentials;

  if (!client_id || !client_secret) {
    throw new Error(
      "Missing OAuth2 credentials: client_id and client_secret are required.\n" +
        "Get them from Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID."
    );
  }

  if (!refresh_token) {
    throw new Error(
      "Missing refresh_token. Run `npx google-mcp init --auth oauth` to complete OAuth2 setup."
    );
  }

  const auth = new google.auth.OAuth2(client_id, client_secret);
  auth.setCredentials({ refresh_token });

  // Auto-refresh: googleapis handles this transparently.
  // Every API call checks if the access token is expired and refreshes if needed.

  return auth;
}

/**
 * Create sheets client using OAuth2.
 */
export function createOAuth2SheetsClient(credentials) {
  const auth = createOAuth2Client(credentials);
  return google.sheets({ version: "v4", auth });
}

/**
 * Generate the OAuth2 authorization URL.
 * User visits this URL, grants access, gets a code.
 */
export function generateAuthUrl(client_id, client_secret) {
  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000/oauth2callback"
  );

  return auth.generateAuthUrl({
    access_type: "offline", // ← CRITICAL: forces refresh_token to be returned
    prompt: "consent",       // ← CRITICAL: always show consent (ensures refresh_token every time)
    scope: ALL_SCOPES,
  });
}

/**
 * Exchange authorization code for tokens.
 * Returns { access_token, refresh_token, expiry_date }.
 */
export async function exchangeCodeForTokens(
  client_id,
  client_secret,
  code
) {
  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000/oauth2callback"
  );

  const { tokens } = await auth.getToken(code);
  return tokens;
}

/**
 * Validate a refresh token by trying to get a fresh access token.
 *
 * Returns { valid: true } or { valid: false, error: string }.
 */
export async function validateRefreshToken(credentials) {
  const { client_id, client_secret, refresh_token } = credentials;

  if (!client_id || !client_secret || !refresh_token) {
    return {
      valid: false,
      error: "Missing credentials (client_id, client_secret, or refresh_token).",
    };
  }

  try {
    const auth = new google.auth.OAuth2(client_id, client_secret);
    auth.setCredentials({ refresh_token });

    // Force token refresh — this will fail if the refresh_token is invalid
    const { credentials: newCreds } = await auth.refreshAccessToken();

    return {
      valid: true,
      expiresAt: newCreds.expiry_date
        ? new Date(newCreds.expiry_date).toISOString()
        : "unknown",
      scopes: newCreds.scope || "unknown",
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
      hint:
        "The refresh token is invalid or revoked. Run `npx google-mcp init --auth oauth` to re-authenticate.",
    };
  }
}

/**
 * Get token info without making an API call.
 * Just checks if the stored token exists and looks valid.
 */
export function getTokenInfo(credentials) {
  const { client_id, client_secret, refresh_token } = credentials;

  const issues = [];

  if (!client_id) issues.push("Missing client_id");
  if (!client_secret) issues.push("Missing client_secret");
  if (!refresh_token) issues.push("Missing refresh_token");

  if (issues.length > 0) {
    return { status: "missing", issues };
  }

  return {
    status: "configured",
    clientId: `${client_id.substring(0, 12)}...`,
    refreshTokenPrefix: `${refresh_token.substring(0, 12)}...`,
  };
}
