#!/usr/bin/env node
/**
 * Google Sheet MCP Server
 *
 * stdio-based MCP server for AI agents.
 * Launched by IDE (Cursor, VS Code, Claude, Codex) via npx.
 *
 * Auth: Service Account (JSON key) or OAuth2 (refresh token with auto-refresh).
 * Config: .google-sheet-mcp.json or env vars.
 *
 * Tools:
 *   sheets_list_tabs      — List all sheet tabs
 *   sheets_read_range     — Read data from a range
 *   sheets_get_sheet      — Get spreadsheet metadata
 *   sheets_write_range    — Write values to a range
 *   sheets_create_tab     — Create a new sheet tab
 *   sheets_append_row     — Append a row (header-aware)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createSheetsClientFromConfig } from "./sheets-client.mjs";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG_FILENAME = ".google-sheet-mcp.json";

function loadServerConfig() {
  // 1. ENV vars — service account
  const envId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!envId) return null;

  const saCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saCreds) {
    return { spreadsheetId: envId, authType: "service-account", credentialsPath: saCreds };
  }

  // OAuth2
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    return {
      spreadsheetId: envId,
      authType: "oauth2",
      oauth2: { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken },
    };
  }

  return null;
}

function loadFileConfig() {
  const paths = [
    resolve(process.cwd(), CONFIG_FILENAME),
    resolve(homedir(), CONFIG_FILENAME),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const c = JSON.parse(readFileSync(p, "utf-8"));
        if (c.spreadsheetId && isValidConfig(c)) return c;
      } catch { /* skip malformed */ }
    }
  }

  return null;
}

function isValidConfig(c) {
  if (c.authType === "oauth2") {
    return !!(c.oauth2?.client_id && c.oauth2?.client_secret && c.oauth2?.refresh_token);
  }
  return !!c.credentialsPath;
}

// ─── Sheets Client ────────────────────────────────────────────────────────────

let _sheets = null;
let _config = null;

function getSheets() {
  if (_sheets) return _sheets;

  _config = loadServerConfig() || loadFileConfig();
  if (!_config) {
    throw new Error(
      "No configuration. Run `npx google-sheet-mcp init` or set env vars."
    );
  }

  _sheets = createSheetsClientFromConfig(_config);
  return _sheets;
}

function getSpreadsheetId() {
  if (_config) return _config.spreadsheetId;
  _config = loadServerConfig() || loadFileConfig();
  return _config?.spreadsheetId;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowsToObjects(rows, skipHeader = false) {
  if (!rows || rows.length === 0) return [];
  if (skipHeader) return rows;
  const [headers, ...data] = rows;
  return data.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

// ─── Tool implementations ────────────────────────────────────────────────────

async function listTabs({ spreadsheet }) {
  const sheets = getSheets();
  const id = spreadsheet || getSpreadsheetId();

  const res = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: "properties.title,sheets.properties",
  });

  const tabs = (res.data.sheets ?? []).map((s) => ({
    title: s.properties?.title || "(unnamed)",
    sheetId: s.properties?.sheetId,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
    hidden: s.properties?.hidden ?? false,
  }));

  return {
    spreadsheetId: id,
    title: res.data.properties?.title,
    tabs,
  };
}

async function readRange({
  spreadsheet,
  range,
  skip_header = false,
  value_render = "FORMATTED_VALUE",
}) {
  const sheets = getSheets();
  const id = spreadsheet || getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range,
    valueRenderOption: value_render,
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = res.data.values;
  const data = rowsToObjects(rows, skip_header);

  return {
    spreadsheetId: id,
    range: res.data.range,
    totalRows: rows ? rows.length : 0,
    rows: data,
  };
}

async function getSheet({ spreadsheet }) {
  const sheets = getSheets();
  const id = spreadsheet || getSpreadsheetId();

  const res = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: "spreadsheetId,spreadsheetUrl,properties,sheets.properties",
  });

  const tabs = (res.data.sheets ?? []).map((s) => ({
    title: s.properties?.title,
    sheetId: s.properties?.sheetId,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));

  return {
    spreadsheetId: res.data.spreadsheetId,
    url: res.data.spreadsheetUrl,
    title: res.data.properties?.title,
    locale: res.data.properties?.locale,
    tabs,
  };
}

async function writeRange({ spreadsheet, range, values }) {
  const sheets = getSheets();
  const id = spreadsheet || getSpreadsheetId();

  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return {
    spreadsheetId: id,
    updatedRange: res.data.updatedRange,
    updatedRows: res.data.updatedRows,
    updatedColumns: res.data.updatedColumns,
    updatedCells: res.data.updatedCells,
  };
}

async function createTab({ spreadsheet, sheetName }) {
  const sheets = getSheets();
  const id = spreadsheet || getSpreadsheetId();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: sheetName },
          },
        },
      ],
    },
  });

  return {
    spreadsheetId: id,
    sheetName,
    created: true,
  };
}

async function appendRow({ spreadsheet, sheet, row }) {
  const sheets = getSheets();
  const id = spreadsheet || getSpreadsheetId();

  // Get headers to align columns
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${sheet}!1:1`,
  });

  const headers = headerRes.data.values?.[0] || Object.keys(row);
  const values = headers.map((h) => row[h] ?? "");

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: `${sheet}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return {
    spreadsheetId: id,
    sheet,
    updatedRange: res.data.updates?.updatedRange,
    row,
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "sheets_list_tabs",
    description:
      "List all sheet tabs in the connected Google Spreadsheet. " +
      "Use this to discover available sheets before reading or writing data.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet: {
          type: "string",
          description:
            "Optional spreadsheet ID. Uses the configured default if omitted.",
        },
      },
    },
  },
  {
    name: "sheets_read_range",
    description:
      "Read data from a Google Sheet range. " +
      "Range format: 'SheetName!A1:Z100' or just 'SheetName' for the whole sheet. " +
      "First row is treated as headers and data is returned as an array of objects.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet: {
          type: "string",
          description: "Optional spreadsheet ID.",
        },
        range: {
          type: "string",
          description:
            "Range in A1 notation. Examples: 'Users!A1:Z500', 'Orders'.",
        },
        skip_header: {
          type: "boolean",
          description:
            "If true, returns raw 2D array instead of objects with header keys.",
          default: false,
        },
        value_render: {
          type: "string",
          enum: ["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"],
          description:
            "How to render values. FORMATTED_VALUE = as seen in UI, UNFORMATTED_VALUE = raw numbers, FORMULA = show formulas.",
          default: "FORMATTED_VALUE",
        },
      },
      required: ["range"],
    },
  },
  {
    name: "sheets_get_sheet",
    description:
      "Get spreadsheet metadata: title, URL, locale, and all tabs with row/column counts.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet: {
          type: "string",
          description: "Optional spreadsheet ID.",
        },
      },
    },
  },
  {
    name: "sheets_write_range",
    description:
      "Write values to a Google Sheet range. Values should be a 2D array: " +
      "each inner array is a row. Example: [['name','age'],['Anton','30']]",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet: {
          type: "string",
          description: "Optional spreadsheet ID.",
        },
        range: {
          type: "string",
          description: "Range to write, e.g., 'Users!A1'.",
        },
        values: {
          type: "array",
          items: { type: "array" },
          description: "2D array of values. First array = first row.",
        },
      },
      required: ["range", "values"],
    },
  },
  {
    name: "sheets_create_tab",
    description: "Create a new sheet tab in the spreadsheet.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet: {
          type: "string",
          description: "Optional spreadsheet ID.",
        },
        sheetName: {
          type: "string",
          description: "Name of the new sheet tab.",
        },
      },
      required: ["sheetName"],
    },
  },
  {
    name: "sheets_append_row",
    description:
      "Append a row to a sheet. The row is a JSON object with column names as keys. " +
      "The tool automatically reads the header row to align columns. " +
      'Example: {"name": "Anton", "email": "anton@example.com"}',
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet: {
          type: "string",
          description: "Optional spreadsheet ID.",
        },
        sheet: {
          type: "string",
          description: "Sheet name (tab name).",
        },
        row: {
          type: "object",
          description:
            "Row data as JSON object. Keys = column headers, values = cell values.",
        },
      },
      required: ["sheet", "row"],
    },
  },
];

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "google-sheet-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "sheets_list_tabs":
        result = await listTabs(args);
        break;
      case "sheets_read_range":
        result = await readRange(args);
        break;
      case "sheets_get_sheet":
        result = await getSheet(args);
        break;
      case "sheets_write_range":
        result = await writeRange(args);
        break;
      case "sheets_create_tab":
        result = await createTab(args);
        break;
      case "sheets_append_row":
        result = await appendRow(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const isOAuth = _config?.authType === "oauth2";
    const hint = isOAuth
      ? "Check token health: `npx google-sheet-mcp token-status`. Re-auth: `npx google-sheet-mcp init --auth oauth`."
      : "Check that the spreadsheet is shared with the service account email.";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error.message,
              authType: _config?.authType || "unknown",
              hint,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  // Check we have a valid config before starting
  const config = loadServerConfig() || loadFileConfig();
  if (!config) {
    console.error(
      "[google-sheet-mcp] ⚠️  No configuration found. " +
        "Run `npx google-sheet-mcp init` or set env vars."
    );
  } else {
    console.error(
      `[google-sheet-mcp] ✅ Configured: ${config.spreadsheetId} (${config.authType || "service-account"})`
    );
    if (config.authType === "oauth2") {
      console.error(
        `[google-sheet-mcp] 🔑 OAuth2 mode — token auto-refreshes. Check health: npx google-sheet-mcp token-status`
      );
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[google-sheet-mcp] Server started (stdio) — waiting for IDE connection...");
}

main().catch((err) => {
  console.error("[google-sheet-mcp] Fatal error:", err);
  process.exit(1);
});
