# Google Sheets MCP Server

Connect Google Sheets to Cursor, VS Code, Claude Code and AI agents — **in 3 minutes**.

> Your spreadsheet becomes a data source that AI agents can read, write, and query.

## 🎯 What is this?

A **Model Context Protocol (MCP) server** that lets AI coding agents (Cursor, Copilot, Claude, Codex) interact with Google Sheets as a database.

Once configured, you can tell your AI agent:

```
"Read all users from the Users sheet"
"Add a new order row: name=Anton, total=150"
"Update the status column for row 23"
"List all sheets in my spreadsheet"
```

## ⚡ Quick Start

> 🇷🇺 **Инструкция на русском:** [docs/quickstart-ru.md](docs/quickstart-ru.md) — пошагово для новичков.

Pick the auth method that fits your use case:

### Service Account (recommended for team/automation)

```bash
npx google-sheet-mcp init
```

You'll need:
- **Google Sheet URL** — paste your sheet link
- **Service Account JSON key** — download from Google Cloud Console

### Personal Account via OAuth2 (for personal sheets)

Use when you want the AI to act **on your behalf** — access your private sheets without sharing them with a service account.

```bash
npx google-sheet-mcp init --auth oauth
```

You'll go through a browser-based OAuth2 flow. A refresh token is saved and **auto-refreshed** — you never need to re-login.

> **📖 [When to use OAuth2 →](docs/setup-oauth2.md)** — detailed guide and scenarios.

### 2. Connect your IDE

Add to **`.cursor/mcp.json`** (Cursor):

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}
```

Or **`.vscode/mcp.json`** (VS Code):

```json
{
  "servers": {
    "google-sheets": {
      "type": "stdio",
      "command": "npx",
      "args": ["google-sheet-mcp"]
    }
  }
}
```

More configs: [`examples/`](examples/) — Cursor, VS Code, Claude, Codex.

### 3. Restart your IDE

That's it. Your AI agent now has access to your Google Sheet.

## 🛠 CLI Commands

| Command | Description |
|---------|------------|
| `npx google-sheet-mcp init` | Interactive setup wizard (service account) |
| `npx google-sheet-mcp init --auth oauth` | Setup with personal Google account (OAuth2) |
| `npx google-sheet-mcp test` | Test connection + list sheets |
| `npx google-sheet-mcp token-status` | Check OAuth2 refresh token health |
| `npx google-sheet-mcp list` | List all sheets in the spreadsheet |
| `npx google-sheet-mcp read -s <name>` | Read data from a sheet |
| `npx google-sheet-mcp create -s <name>` | Create a new sheet tab |
| `npx google-sheet-mcp append -s <name> -d '{"col":"val"}'` | Append a row |
| `npx google-sheet-mcp config` | Show current configuration |

## 🧠 MCP Tools (for AI Agents)

Once connected, AI agents get these tools:

| Tool | What it does |
|------|-------------|
| `sheets_list_tabs` | List all sheet tabs with row/column counts |
| `sheets_read_range` | Read data from a range (returns objects with header keys) |
| `sheets_get_sheet` | Get spreadsheet metadata (title, URL, locale) |
| `sheets_write_range` | Write a 2D array of values to a range |
| `sheets_create_tab` | Create a new sheet tab |
| `sheets_append_row` | Append a row (auto-aligns with headers) |

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
