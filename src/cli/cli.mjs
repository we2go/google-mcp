#!/usr/bin/env node
/**
 * google-mcp CLI
 *
 * Usage:
 *   npx google-mcp init        — Setup (service account, default)
 *   npx google-mcp init --auth oauth  — Setup (OAuth2, personal account)
 *   npx google-mcp test        — Test connection
 *   npx google-mcp token-status — Check OAuth2 token health
 *   npx google-mcp list        — List sheet tabs
 *   npx google-mcp read        — Read sheet data
 *   npx google-mcp config      — Show current config
 *   npx google-mcp docs-list   — List Google Docs
 *   npx google-mcp docs-read   — Read a Google Doc
 *   npx google-mcp docs-create — Create a new Google Doc
 */

import { program } from "commander";
import { initCommand } from "./commands/init.mjs";
import { testCommand } from "./commands/test.mjs";
import { listCommand } from "./commands/list.mjs";
import { readCommand } from "./commands/read.mjs";
import { configCommand } from "./commands/config.mjs";
import { createCommand } from "./commands/create.mjs";
import { appendCommand } from "./commands/append.mjs";
import { tokenStatusCommand } from "./commands/token-status.mjs";
import { docsListCommand } from "./commands/docs-list.mjs";
import { docsReadCommand } from "./commands/docs-read.mjs";
import { docsCreateCommand } from "./commands/docs-create.mjs";

program
  .name("google-mcp")
  .description(
    "Connect Google Sheets & Docs to Cursor, VS Code, Claude Code and AI agents in 3 minutes."
  )
  .version("2.1.2");

program
  .command("init")
  .description("Interactive setup: connect a Google Sheet")
  .option(
    "--auth <type>",
    "Authentication type: service-account (default) or oauth",
    "service-account"
  )
  .action(initCommand);

program
  .command("test")
  .description("Test connection to the configured Google Sheet")
  .option("-s, --sheet <name>", "Test reading a specific sheet")
  .action(testCommand);

program
  .command("list")
  .description("List all sheets in a spreadsheet")
  .option("-i, --id <spreadsheetId>", "Google Spreadsheet ID (if not configured)")
  .option("-s, --sheet <spreadsheetId>", "Alias for --id")
  .action(listCommand);

program
  .command("read")
  .description("Read data from a sheet")
  .requiredOption("-s, --sheet <name>", "Sheet name to read")
  .option("-r, --range <range>", "Cell range in A1 notation (e.g., A1:Z100)")
  .option("--raw", "Return raw 2D array instead of objects")
  .action(readCommand);

program
  .command("config")
  .description("Show current configuration")
  .action(configCommand);

program
  .command("create")
  .description("Create a new sheet")
  .requiredOption("-s, --sheet <name>", "New sheet name")
  .action(createCommand);

program
  .command("append")
  .description("Append a row to a sheet")
  .requiredOption("-s, --sheet <name>", "Sheet name")
  .requiredOption(
    "-d, --data <json>",
    "Row data as JSON (e.g., '{\"name\":\"Anton\"}')"
  )
  .action(appendCommand);

program
  .command("token-status")
  .description("Check OAuth2 token health (validates refresh token)")
  .action(tokenStatusCommand);

// ─── Docs commands ───────────────────────────────────────────────────────────

program
  .command("docs-list")
  .description("List Google Docs in your Drive")
  .option("-q, --query <text>", "Filter by name (contains)")
  .option("-l, --limit <number>", "Max results (default: 20)")
  .action(docsListCommand);

program
  .command("docs-read")
  .description("Read a Google Doc by ID")
  .requiredOption("-d, --document <id>", "Google Doc ID")
  .option("--full", "Return structured body instead of plain text")
  .action(docsReadCommand);

program
  .command("docs-create")
  .description("Create a new Google Doc")
  .requiredOption("-t, --title <title>", "Document title")
  .action(docsCreateCommand);

program.parse(process.argv);
