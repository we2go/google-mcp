# Google MCP Server

Connect Google Sheets & Docs to Cursor, VS Code, Claude Code and AI agents — **in 3 minutes**.

> Your spreadsheets and documents become data sources that AI agents can read, write, and query.

## 🎯 What is this?

A **Model Context Protocol (MCP) server** that lets AI coding agents (Cursor, Copilot, Claude, Codex) interact with Google Sheets and Google Docs.

Once configured, you can tell your AI agent:

**📊 Sheets:**
```
"Read all users from the Users sheet"
"Add a new order row: name=Anton, total=150"
"Update the status column for row 23"
"List all sheets in my spreadsheet"
```

**📄 Docs:**
```
"Create a new document titled 'Sprint Report'"
"Read the content of my meeting notes"
"Append a summary paragraph to the project doc"
"Find and replace all 'TODO' with 'DONE'"
"List all my Google Docs"
```

## ⚡ Quick Start

> 🇷🇺 **Инструкция на русском:** [docs/quickstart-ru.md](docs/quickstart-ru.md) — пошагово для новичков.

Pick the auth method that fits your use case:

### Service Account (recommended for team/automation)

```bash
npx google-mcp init
```

You'll need:
- **Google Sheet URL** — paste your sheet link
- **Service Account JSON key** — download from Google Cloud Console

### Personal Account via OAuth2 (for personal sheets/docs)

Use when you want the AI to act **on your behalf** — access your private sheets and docs without sharing them with a service account.

```bash
npx google-mcp init --auth oauth
```

You'll go through a browser-based OAuth2 flow. A refresh token is saved and **auto-refreshed** — you never need to re-login.

> **📖 [When to use OAuth2 →](docs/setup-oauth2.md)** — detailed guide and scenarios.

### 2. Connect your IDE

The `init` wizard will generate IDE configs for you automatically — just pick **Project** or **System-wide** when asked.

If you prefer manual setup, add to your IDE config:

<details>
<summary>Cursor — <code>.cursor/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "google-mcp": {
      "command": "npx",
      "args": ["google-mcp"]
    }
  }
}
```
</details>

<details>
<summary>VS Code — <code>.vscode/mcp.json</code></summary>

```json
{
  "servers": {
    "google-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["google-mcp"]
    }
  }
}
```
</details>

<details>
<summary>Claude Code — <code>.claude/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "google-mcp": {
      "command": "npx",
      "args": ["google-mcp"]
    }
  }
}
```
</details>

<details>
<summary>Codex CLI — <code>codex.json</code></summary>

```json
{
  "mcpServers": {
    "google-mcp": {
      "command": "npx",
      "args": ["-y", "google-mcp"]
    }
  }
}
```
</details>

More configs: [`examples/`](examples/) — Cursor, VS Code, Claude, Codex.

### 3. Restart your IDE

That's it. Your AI agent now has access to your Google Sheets and Docs.

## 🛠 CLI Commands

| Command | Description |
|---------|------------|
| `npx google-mcp init` | Interactive setup wizard (service account) |
| `npx google-mcp init --auth oauth` | Setup with personal Google account (OAuth2) |
| `npx google-mcp test` | Test connection + list sheets |
| `npx google-mcp token-status` | Check OAuth2 refresh token health |
| `npx google-mcp list` | List all sheets in the spreadsheet |
| `npx google-mcp read -s <name>` | Read data from a sheet |
| `npx google-mcp create -s <name>` | Create a new sheet tab |
| `npx google-mcp append -s <name> -d '{"col":"val"}'` | Append a row |
| `npx google-mcp config` | Show current configuration |
| `npx google-mcp docs-list` | List Google Docs in your Drive |
| `npx google-mcp docs-read -d <id>` | Read a Google Doc by ID |
| `npx google-mcp docs-create -t <title>` | Create a new Google Doc |

> 💡 **Backward compatible:** `npx google-sheet-mcp` still works as an alias for `npx google-mcp`.

## 🧠 MCP Tools (for AI Agents)

Once connected, AI agents get these tools:

### 📊 Sheets
| Tool | What it does |
|------|-------------|
| `sheets_list_tabs` | List all sheet tabs with row/column counts |
| `sheets_read_range` | Read data from a range (returns objects with header keys) |
| `sheets_get_sheet` | Get spreadsheet metadata (title, URL, locale) |
| `sheets_write_range` | Write a 2D array of values to a range |
| `sheets_create_tab` | Create a new sheet tab |
| `sheets_append_row` | Append a row (auto-aligns with headers) |

### 📄 Docs
| Tool | What it does |
|------|-------------|
| `docs_create` | Create a new Google Doc |
| `docs_read` | Read document content (plain text or structured) |
| `docs_get` | Get document metadata (title, URL, revision, length) |
| `docs_write` | Write/append text to a document |
| `docs_replace` | Find and replace text in a document |
| `docs_list` | List Google Docs in your Drive |

## 🔐 Prerequisites

### Google Cloud Setup (3 min)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. **Enable Sheets API**: APIs & Services → Library → "Google Sheets API" → Enable
4. **Create Service Account**: APIs & Services → Credentials → Create Credentials → Service Account
5. Give it a name → Create → Done
6. Click the service account → Keys → Add Key → Create New Key → JSON → Download
7. **Share your sheet**: Open your Google Sheet → Share → add the service account email (from the JSON) as **Editor**

> 📖 Detailed guide with screenshots: [docs/setup-google.md](docs/setup-google.md)

### OAuth2 Setup (for personal Google accounts)

**When to use OAuth2 instead of Service Account:**

- You want AI to access **your personal sheets** that you don't want to share with a service account
- You're the only user and don't want to create a service account
- Your sheets contain sensitive data that shouldn't be accessible via a shared key

**Setup:**

```bash
npx google-sheet-mcp init --auth oauth
```

The wizard will:
1. Ask for your OAuth2 Client ID and Client Secret (from Google Cloud Console)
2. Open a browser for you to grant access
3. Capture the authorization code automatically
4. Exchange it for a **refresh token** (stored locally)

**How refresh tokens work:**

- The refresh token is stored in `.google-sheet-mcp.json`
- Access tokens are **auto-refreshed** by googleapis — you never need to re-login
- If a token becomes invalid, just run `npx google-sheet-mcp init --auth oauth` to replace it

**Check token health:**

```bash
npx google-sheet-mcp token-status
```

> 🔑 **Key benefit:** The AI agent acts as *you* — it accesses exactly the sheets you have access to. No need to share sheets with a service account email.

> 📖 Detailed guide: [docs/setup-oauth2.md](docs/setup-oauth2.md)

## 📁 Configuration

Config is stored in `.google-sheet-mcp.json` (in your project or home directory):

```json
{
  "spreadsheetId": "1ABC...xyz",
  "credentialsPath": "./credentials.json",
  "sheets": ["Users", "Orders", "Payments"]
}
```

Or use environment variables:

```bash
export GOOGLE_SPREADSHEET_ID="1ABC...xyz"
export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
```

## 🏗 Architecture

```
google-sheet-mcp/
├── src/
│   ├── cli/              # CLI commands (init, test, list, read, append)
│   ├── server/           # MCP stdio server + Google Sheets client
│   └── config/           # Config loader (.google-sheet-mcp.json + env)
├── examples/             # MCP configs for Cursor, VS Code, Claude, Codex
├── docs/                 # Setup guides
├── README.md
└── package.json
```

## ❓ FAQ

### Do I need to clone this repo?
No. Just use `npx google-sheet-mcp init`. No installation required.

### What permissions does the service account need?
Only "Editor" on the specific spreadsheet. Not on your entire Google Drive.

### Can I connect multiple sheets?
Yes. Use different config files per project, or set env vars per spreadsheet.

### Does it work with private sheets?
Yes. Share the sheet with the service account email (found in the JSON key).

### Is my data sent to a third party?
No. The MCP server runs **locally** on your machine. Google Sheets API calls go directly from your machine to Google. No intermediate servers.

## 📄 License

MIT
