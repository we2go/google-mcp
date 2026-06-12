# Google Cloud Setup Guide

> Step-by-step: Create a Service Account and enable Sheets API.

⏱ **Time: ~3 minutes** (first time)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top-left, next to "Google Cloud")
3. Click **NEW PROJECT**
4. Name it (e.g., `my-sheets-mcp`) → **CREATE**

> If you already have a project, skip to Step 2.

---

## Step 2: Enable Google Sheets API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Sheets API"
3. Click on it → **ENABLE**

> Wait a few seconds for the API to activate.

---

## Step 3: Create a Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **CREATE CREDENTIALS** → **Service Account**
3. Fill in:
   - **Service account name**: `sheets-mcp` (or any name)
   - **Service account ID**: auto-filled
   - **Description**: `Access for Google Sheet MCP server` (optional)
4. Click **CREATE AND CONTINUE**
5. Role: **Basic → Editor** (or skip — we only need sheet access, not project-wide)
6. Click **DONE**

---

## Step 4: Download JSON Key

1. In the Credentials page, find your service account under "Service Accounts"
2. Click on its email address
3. Go to **KEYS** tab
4. Click **ADD KEY** → **Create New Key**
5. Select **JSON** → **CREATE**

The JSON file downloads automatically. Save it somewhere safe, e.g.:
```
~/my-project/credentials.json
```

> ⚠️ **Security:** This key gives access to any sheet shared with this account. Don't commit it to git. Add `credentials.json` to `.gitignore`.

---

## Step 5: Share Your Sheet with the Service Account

1. Open the JSON key file you downloaded
2. Find the `client_email` field (e.g., `sheets-mcp@my-project.iam.gserviceaccount.com`)
3. Copy that email address
4. Open your Google Sheet → click **Share** (top-right)
5. Paste the email → set permission to **Editor**
6. Click **Send** (or "Share anyway" if prompted)

> **Why Editor?** The MCP server needs to both read and write. If you only need read access, **Viewer** is enough.

---

## Step 6: Test the Connection

```bash
npx google-sheet-mcp init
```

Paste your sheet URL and credentials path. The wizard will test the connection.

Or manually:

```bash
export GOOGLE_SPREADSHEET_ID="1ABC...xyz"
export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
npx google-sheet-mcp test
```

Expected output:

```
🔗 Google Sheet MCP — Connection Test

✅ Connected to "My Spreadsheet"
✓ Users (150 rows × 6 cols)
✓ Orders (320 rows × 8 cols)

✅ Connection OK — ready to use from AI agents!
```

---

## Troubleshooting

### "Credentials file not found"
Make sure the path to the JSON file is correct. Use absolute path if unsure:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/you/project/credentials.json"
```

### "Google Sheets API has not been used in project"
The Sheets API is not enabled. Go back to Step 2 and click **ENABLE**.

### "The caller does not have permission"
The service account doesn't have access to the sheet. Go back to Step 5 and share the sheet with `client_email` from the JSON.

### "Error: insufficient authentication scopes"
The service account key might be for a different API. Make sure you downloaded the JSON key for the right service account.

### Can I use the same key for multiple sheets?
Yes. Share each sheet with the same `client_email` from the JSON key.
