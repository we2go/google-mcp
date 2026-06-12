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
    "google-sheets": {
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.bold("VS Code (.vscode/mcp.json):"));
  console.log(
    chalk.white(`{
  "servers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.bold("Claude Code (.claude/mcp.json):"));
  console.log(
    chalk.white(`{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}`)
  );
  console.log();
  console.log(chalk.bold("Codex CLI (codex.json):"));
  console.log(
    chalk.white(`{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["-y", "google-sheet-mcp"]
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
  console.log(chalk.green("  • sheets_list_tabs — list all sheets"));
  console.log(chalk.green("  • sheets_read_range — read data"));
  console.log(chalk.green("  • sheets_get_sheet — sheet metadata"));
  console.log(chalk.green("  • sheets_write_range — write data"));
  console.log(chalk.green("  • sheets_create_tab — create new tab"));
  console.log(chalk.green("  • sheets_append_row — append a row"));
  console.log();
}
