/**
 * generate-ide-configs — Auto-generate IDE MCP configuration files.
 *
 * Supports: Cursor (.cursor/mcp.json), VS Code / Copilot (.vscode/mcp.json),
 *           Claude Code (.claude/mcp.json), Codex CLI (codex.json)
 * Locations: project (cwd) or system-wide (~/.cursor/, ~/.vscode/, ~/.claude/)
 *
 * Behavior:
 *   - Auto-detects IDE presence in the project
 *   - Asks user where to install (project / system / skip)
 *   - Merges with existing config — never overwrites other servers
 *   - Default: project level (when user picks "do everything auto")
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";

// ─── MCP config templates ──────────────────────────────────────────────────

const CURSOR_TEMPLATE = {
  mcpServers: {
    "google-sheets": {
      command: "npx",
      args: ["google-sheet-mcp"],
    },
  },
};

const VSCODE_TEMPLATE = {
  servers: {
    "google-sheets": {
      type: "stdio",
      command: "npx",
      args: ["google-sheet-mcp"],
    },
  },
};

const CLAUDE_TEMPLATE = {
  mcpServers: {
    "google-sheets": {
      command: "npx",
      args: ["google-sheet-mcp"],
    },
  },
};

const CODEX_TEMPLATE = {
  mcpServers: {
    "google-sheets": {
      command: "npx",
      args: ["-y", "google-sheet-mcp"],
    },
  },
};

/**
 * IDE specs.
 * `dir`   — subdirectory ("" = project root)
 * `sysDir` — subdirectory for system-wide install (null = skip system-wide)
 */
const IDE_SPECS = {
  cursor: { dir: ".cursor", sysDir: ".cursor", file: "mcp.json", template: CURSOR_TEMPLATE, label: "Cursor" },
  vscode:  { dir: ".vscode",  sysDir: ".vscode",  file: "mcp.json", template: VSCODE_TEMPLATE,  label: "VS Code / Copilot" },
  claude:  { dir: ".claude",  sysDir: ".claude",  file: "mcp.json", template: CLAUDE_TEMPLATE,  label: "Claude Code" },
  codex:   { dir: "",           sysDir: ".codex",   file: "codex.json", template: CODEX_TEMPLATE,   label: "Codex CLI" },
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Main entry point. Called from init.mjs after successful connection + config save.
 *
 * @param {object}  opts
 * @param {string}  opts.cwd          — project working directory (process.cwd())
 * @param {boolean} opts.skipPrompt   — if true, use defaults without asking (for --yes / automation)
 * @returns {Promise<{count: number, files: string[]}>}
 */
export async function generateIDEConfigs({ cwd, skipPrompt = false } = {}) {
  const workDir = cwd || process.cwd();

  console.log(chalk.bold("━━━ IDE Configuration ━━━"));
  console.log();

  // Detect which IDEs are already set up in the project
  const detected = detectProjectIDEs(workDir);

  let target;

  if (skipPrompt) {
    // Default: project-level
    target = "project";
    console.log(chalk.gray("  Auto-selected: project-level configuration"));
  } else {
    // Build choices dynamically
    const choices = buildChoices(workDir, detected);

    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "target",
        message: "Where to install MCP configuration?",
        default: "project",
        choices,
      },
    ]);

    target = answer.target;
  }

  if (target === "skip") {
    console.log(chalk.gray("  Skipped. You can add the config manually later."));
    console.log();
    printManualConfig();
    return { count: 0, files: [] };
  }

  // Resolve base path
  const basePath = target === "system" ? homedir() : workDir;
  const locationLabel = target === "system" ? "system-wide" : "project";

  console.log();
  console.log(chalk.gray(`  Installing to: ${locationLabel} (${basePath})`));
  console.log();

  // Write configs
  const created = writeIDEConfigs(basePath, target === "system");

  // Report
  for (const entry of created) {
    if (entry.merged) {
      console.log(chalk.green(`  ✅ ${entry.ide}: merged into existing ${entry.path}`));
    } else {
      console.log(chalk.green(`  ✅ ${entry.ide}: created ${entry.path}`));
    }
  }

  if (created.length === 0) {
    console.log(chalk.yellow("  ⚠️  No config files were created."));
  }

  console.log();
  console.log(chalk.bold("🚀 Ready! Restart your IDE to activate."));
  console.log();
  printToolsHint();
  console.log();

  return {
    count: created.length,
    files: created.map((c) => c.path),
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Detect which IDEs are present in the project directory.
 */
function detectProjectIDEs(cwd) {
  const found = [];
  for (const [key, spec] of Object.entries(IDE_SPECS)) {
    const dirPath = spec.dir ? join(cwd, spec.dir) : cwd;
    const filePath = join(dirPath, spec.file);
    if (existsSync(dirPath) || existsSync(filePath)) {
      found.push(key);
    }
  }
  return found;
}

/**
 * Build inquirer choices based on detection.
 */
function buildChoices(cwd, detected) {
  const choices = [];

  if (detected.length > 0) {
    const labels = detected.map((k) => IDE_SPECS[k].label).join(" + ");
    const firstDir = IDE_SPECS[detected[0]].dir || "(root)";
    choices.push({
      name: `📁 Project — ${labels} (${join(cwd, firstDir)})`,
      value: "project",
    });
  } else {
    choices.push({
      name: `📁 Project — .cursor/, .vscode/, .claude/, codex.json`,
      value: "project",
    });
  }

  choices.push({
    name: `🏠 System-wide — ~/.cursor/, ~/.vscode/, ~/.claude/, ~/.codex/`,
    value: "system",
  });

  choices.push({
    name: `⏭️  Skip — I'll configure manually`,
    value: "skip",
  });

  return choices;
}

/**
 * Write IDE configs to the given base path.
 * For project-level: uses spec.dir (codex → root)
 * For system-wide: uses spec.sysDir (codex → ~/.codex/)
 * Returns array of { ide, path, merged }.
 */
function writeIDEConfigs(basePath, isSystem) {
  const created = [];

  for (const [, spec] of Object.entries(IDE_SPECS)) {
    const subDir = isSystem ? (spec.sysDir || spec.dir) : spec.dir;
    const dirPath = subDir ? join(basePath, subDir) : basePath;
    const filePath = join(dirPath, spec.file);

    // Ensure directory exists
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    // Read existing config (if any)
    let existing = {};
    let existed = false;
    if (existsSync(filePath)) {
      existed = true;
      try {
        existing = JSON.parse(readFileSync(filePath, "utf-8"));
      } catch {
        console.log(
          chalk.yellow(`  ⚠️  ${spec.label}: existing ${filePath} is invalid JSON — overwriting`)
        );
      }
    }

    // Deep-merge: add google-sheets server, don't touch other servers
    const merged = deepMergeConfig(existing, spec.template);

    writeFileSync(filePath, JSON.stringify(merged, null, 2) + "\n");
    created.push({ ide: spec.label, path: filePath, merged: existed });
  }

  return created;
}

/**
 * Deep-merge template into existing config.
 * Existing servers are preserved. google-sheets is added if not present.
 * If google-sheets already exists, leave it alone (user may have customized).
 */
function deepMergeConfig(existing, template) {
  const result = JSON.parse(JSON.stringify(existing));

  for (const [topKey, servers] of Object.entries(template)) {
    if (!result[topKey]) {
      result[topKey] = {};
    }
    for (const [serverName, serverConfig] of Object.entries(servers)) {
      if (!result[topKey][serverName]) {
        result[topKey][serverName] = serverConfig;
      }
    }
  }

  return result;
}

// ─── Fallback: manual config display (when user chooses skip) ───────────────

function printManualConfig() {
  console.log(chalk.bold("Cursor (.cursor/mcp.json):"));
  console.log(chalk.white(JSON.stringify(CURSOR_TEMPLATE, null, 2)));
  console.log();
  console.log(chalk.bold("VS Code (.vscode/mcp.json):"));
  console.log(chalk.white(JSON.stringify(VSCODE_TEMPLATE, null, 2)));
  console.log();
  console.log(chalk.bold("Claude Code (.claude/mcp.json):"));
  console.log(chalk.white(JSON.stringify(CLAUDE_TEMPLATE, null, 2)));
  console.log();
  console.log(chalk.bold("Codex CLI (codex.json):"));
  console.log(chalk.white(JSON.stringify(CODEX_TEMPLATE, null, 2)));
}

function printToolsHint() {
  console.log(chalk.gray("  The AI agent will have access to these tools:"));
  console.log(chalk.green("  • sheets_list_tabs    — list all sheet tabs"));
  console.log(chalk.green("  • sheets_read_range   — read data from a range"));
  console.log(chalk.green("  • sheets_get_sheet    — spreadsheet metadata"));
  console.log(chalk.green("  • sheets_write_range  — write values to a range"));
  console.log(chalk.green("  • sheets_create_tab   — create a new tab"));
  console.log(chalk.green("  • sheets_append_row   — append a row"));
}
