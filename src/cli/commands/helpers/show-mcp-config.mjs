/**
 * Show MCP configuration snippets for all supported IDEs.
 */

import chalk from "chalk";

export function showMCPConfig() {
  console.log(chalk.bold("━━━ MCP Configuration ━━━"));
  console.log();
  console.log(chalk.bold("Cursor (.cursor/mcp.json):"));
  console.log(
    chalk.white(`{
  "mcpServers": {
    "google-mcp": {
      "command": "npx",
      "args": ["google-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.bold("VS Code (.vscode/mcp.json):"));
  console.log(
    chalk.white(`{
  "servers": {
    "google-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["google-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.bold("Claude Code (.claude/mcp.json):"));
  console.log(
    chalk.white(`{
  "mcpServers": {
    "google-mcp": {
      "command": "npx",
      "args": ["google-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.bold("Codex CLI (codex.json):"));
  console.log(
    chalk.white(`{
  "mcpServers": {
    "google-mcp": {
      "command": "npx",
      "args": ["-y", "google-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log();
  console.log(
    "After adding the config, restart your IDE. The AI will see these tools:"
  );
  console.log(chalk.green("  📊 Sheets:"));
  console.log(chalk.green("  • sheets_list_tabs — list all sheets"));
  console.log(chalk.green("  • sheets_read_range — read data"));
  console.log(chalk.green("  • sheets_get_sheet — sheet metadata"));
  console.log(chalk.green("  • sheets_write_range — write data"));
  console.log(chalk.green("  • sheets_create_tab — create new tab"));
  console.log(chalk.green("  • sheets_append_row — append a row"));
  console.log(chalk.green("  📄 Docs:"));
  console.log(chalk.green("  • docs_create — create a new document"));
  console.log(chalk.green("  • docs_read — read document content"));
  console.log(chalk.green("  • docs_get — document metadata"));
  console.log(chalk.green("  • docs_write — write/append text"));
  console.log(chalk.green("  • docs_replace — find and replace"));
  console.log(chalk.green("  • docs_list — list documents in Drive"));
  console.log();
}
