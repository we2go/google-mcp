# OAuth2 Setup — Personal Google Account

> Use OAuth2 when you want the AI to act **on your behalf** with your personal Google Sheets.

⏱ **Time: ~5 minutes** (first time)

---

## When to use OAuth2 vs Service Account

| Scenario | Use |
|----------|-----|
| Team/shared spreadsheet, automation | Service Account |
| Your personal spreadsheet, AI assistant | **OAuth2** |
| You don't want to share sheets with a robot email | **OAuth2** |
| CI/CD pipeline, server-side automation | Service Account |
| Quick prototype with your own data | **OAuth2** |

**With OAuth2:**
- The AI agent accesses sheets **as you** — exactly the sheets you have permission to
- No need to "Share with service account email"
- Token is personal — don't share your `.google-sheet-mcp.json` with others

---

## Step 1: Create OAuth2 Credentials in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. **Enable Sheets API**: APIs & Services → Library → "Google Sheets API" → Enable
4. Go to **APIs & Services** → **Credentials**
5. Click **CREATE CREDENTIALS** → **OAuth client ID**
6. Configure the consent screen if prompted:
   - User Type: **External**
   - App name: `Google Sheet MCP` (or any name)
   - User support email: your email
   - Developer contact email: your email
   - Scopes: you can skip adding scopes manually (the app requests them at runtime)
   - Add yourself as a test user
7. Back to Create OAuth client ID:
   - Application type: **Desktop app**
   - Name: `google-sheet-mcp`
8. Click **CREATE**
9. Copy the **Client ID** and **Client Secret**

---

## Step 2: Run the OAuth2 Setup Wizard

```bash
npx google-sheet-mcp init --auth oauth
```

The wizard asks:
- **Google Sheet URL** — paste your sheet link
- **Client ID** — from Step 1
- **Client Secret** — from Step 1

Then it:
1. Opens a browser URL for you (or prints it)
2. You sign in with your Google account
3. You grant access to Google Sheets
4. The authorization code is captured automatically
5. Tokens are saved

---

## Step 3: What Happens Under the Hood

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Your       │     │   Google    │     │   Google     │
│   Terminal   │────▶│   OAuth2    │────▶│   Sheets     │
│   (CLI)      │     │   Server    │     │   API        │
└──────────────┘     └─────────────┘     └──────────────┘
       │                    │                    │
       │  1. Open URL       │                    │
       │──────────────────▶ │                    │
       │  2. You login      │                    │
       │     & grant access  │                    │
       │  3. Auth code       │                    │
       │◀────────────────── │                    │
       │                    │  4. Exchange code  │
       │                    │     for tokens      │
       │                    │──────────────────▶ │
       │                    │  5. Refresh token   │
       │                    │◀────────────────── │
       │                    │                    │
       │  6. Refresh token  │                    │
       │  saved to config   │                    │
       │◀────────────────── │                    │
       │                    │                    │
       │  Every API call:   │                    │
       │  refresh token     │                    │
       │  → fresh access    │                    │
       │    token (auto)    │                    │
```

---

## Token Auto-Refresh

You never need to re-login. The `googleapis` library automatically:

1. Sends the stored `refresh_token`
2. Gets a fresh `access_token` (valid for 1 hour)
3. Uses the `access_token` for API calls
4. When `access_token` expires, repeats from step 1

### Check Token Health

```bash
npx google-sheet-mcp token-status
```

Expected output:

```
🔑 Google Sheet MCP — Token Status

  Config source: local
  Auth type:     oauth2

Stored token:
  Status:       configured
  Client ID:    123456789012-...
  Refresh:      1//09BY_K6-BZ...

  ✔ Token is valid
  Access token expires: 2026-06-12T16:00:00.000Z
  Scopes: https://www.googleapis.com/auth/spreadsheets

✅ Refresh token is healthy
  AI agents can now access your Google Sheets on your behalf.
```

---

## Replacing an Invalid Token

If the refresh token is revoked or expired:

```bash
npx google-sheet-mcp init --auth oauth
```

This walks you through the OAuth flow again and saves a new refresh token. No need to delete config files manually.

---

## Troubleshooting

### "Access blocked: This app's request is invalid"
Your OAuth consent screen may not be published. Go to Google Cloud Console → APIs & Services → OAuth consent screen → add yourself as a test user.

### "No refresh token returned"
Make sure `access_type=offline` is set (the CLI does this automatically). Try again and make sure to **approve all permissions**.

### "Token is invalid" (token-status)
The refresh token may have been revoked:
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "Google Sheet MCP"
3. Remove it
4. Run `npx google-sheet-mcp init --auth oauth` again

### "Request had insufficient authentication scopes"
You may have not granted the `spreadsheets` scope during OAuth. Remove the app from your Google Account permissions and re-authorize.

---

## Security Notes

- 🔒 The refresh token is stored in `.google-sheet-mcp.json` — **don't commit this file**
- 🔒 Add `.google-sheet-mcp.json` to `.gitignore`
- 🔒 The token grants access to **all your Google Sheets** — treat it like a password
- 🔒 You can revoke access anytime: [Google Account Permissions](https://myaccount.google.com/permissions)
- 🔒 For team usage, prefer Service Accounts
