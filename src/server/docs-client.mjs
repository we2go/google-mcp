/**
 * Google Docs client — dual auth: service account + OAuth2.
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

// ─── Docs scopes ─────────────────────────────────────────────────────────────

export const DOCS_SCOPES = [
  "https://www.googleapis.com/auth/documents",
];

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
];

// ─── Client factories ────────────────────────────────────────────────────────

/**
 * Create docs client from loaded config.
 * Detects auth type automatically.
 */
export function createDocsClientFromConfig(config) {
  const { authType } = config;

  if (authType === "oauth2") {
    return createOAuth2DocsClient(config);
  }

  // Default: service account
  return createServiceAccountDocsClient(config);
}

/**
 * Service Account: create authenticated Google Docs client from JSON key path.
 */
export function createServiceAccountDocsClient(config) {
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
    scopes: [...DOCS_SCOPES, ...DRIVE_SCOPES],
  });

  return google.docs({ version: "v1", auth });
}

/**
 * OAuth2: create authenticated Google Docs client from refresh token.
 */
export function createOAuth2DocsClient(config) {
  const { oauth2 } = config;
  if (!oauth2 || !oauth2.client_id || !oauth2.client_secret || !oauth2.refresh_token) {
    throw new Error(
      "Missing OAuth2 credentials. Run `npx google-mcp init --auth oauth` to configure."
    );
  }

  const auth = createOAuth2Client(oauth2);
  return google.docs({ version: "v1", auth });
}

/**
 * Create Drive client (for listing docs).
 */
export function createDriveClientFromConfig(config) {
  const { authType } = config;

  if (authType === "oauth2") {
    const { oauth2 } = config;
    const auth = createOAuth2Client(oauth2);
    return google.drive({ version: "v3", auth });
  }

  // Service account
  const credentialsPath = config.credentialsPath;
  const resolvedPath = resolve(credentialsPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Credentials file not found: ${resolvedPath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: resolvedPath,
    scopes: [...DOCS_SCOPES, ...DRIVE_SCOPES],
  });

  return google.drive({ version: "v3", auth });
}

// ─── Document helpers ────────────────────────────────────────────────────────

/**
 * Extract plain text from a Google Doc body structure.
 * The body contains StructuralElement objects, each possibly having
 * a paragraph with textRun elements.
 */
export function extractTextFromDoc(doc) {
  const content = doc.body?.content || [];
  const lines = [];

  for (const item of content) {
    if (item.paragraph) {
      const paragraphText = item.paragraph.elements
        ?.map((el) => el.textRun?.content || "")
        .join("") || "";
      lines.push(paragraphText);
    }
    // Tables, section breaks etc. — skip for plain text
  }

  return lines.join("").trim();
}

/**
 * Get the end index of the document body (for appending text).
 */
export function getDocEndIndex(doc) {
  const content = doc.body?.content || [];
  if (content.length === 0) return 1;

  // The last element's endIndex is the end of the document body
  const last = content[content.length - 1];
  // endIndex is exclusive of newline; we want to insert before the final newline
  return (last.endIndex || 1) - 1;
}
