# Vercel Control Center for VS Code

Manage, deploy, debug, configure, monitor, and troubleshoot your Vercel projects directly inside Visual Studio Code.

> **Note**: This is a community-developed extension and is not officially affiliated with or endorsed by Vercel Inc.

---

## Features

- **Activity Bar Workspace**:
  - **Current Project**: Live production domain, active deployment status, framework, billable duration, and CPU minutes.
  - **Deployments**: Grouped by environment (Production, Preview, Development), with real-time build status badges, rollback, redeploy, cancel, and log inspection.
  - **Environment Variables**: Production, Preview, and Development variables with masked values (`••••••••`), CLI pull/push, and environment comparison diffing.
  - **Domains & DNS**: SSL status, verification badges, and automated DNS diagnostics.
  - **All Projects & Teams**: Global project browser with instant team-scoped search and switching.
  - **Platform Services & Security**: Vercel Blob explorer, Queues, AI Gateway, WAF managed rules, and BotID.
- **CLI & Dry-Run Integration**:
  - Perform `vercel deploy --dry` to inspect included files, ignored files, and deployment size before uploading.
- **Deterministic Diagnostics**:
  - Rule-based detection of missing environment variables, build command failures, framework detection mismatches, DNS misconfigurations, and configuration drift.
- **Provider-Agnostic AI Assistant**:
  - "Explain this error" and "Investigate Runtime Error" using Gemini, OpenAI, or Anthropic.
  - All logs and payloads are rigorously sanitized to prevent credential or secret leakage.
- **Zero Token Leakage**:
  - Securely stores Personal Access Tokens in VS Code's native `SecretStorage`. Never stores secrets in `settings.json` or project files.

---

## Commands

| Command | Description |
| :--- | :--- |
| `Vercel: Login` | Securely store your Vercel Personal Access Token |
| `Vercel: Logout` | Clear credentials and reset extension state |
| `Vercel: Switch Team / Scope` | Switch between Personal account and Teams |
| `Vercel: Deploy` | Deploy local workspace to Vercel |
| `Vercel: Deploy Preview` | Create a preview deployment |
| `Vercel: Deploy Production` | Deploy directly to production |
| `Vercel: Deploy Dry Run` | Inspect deployment bundle files and sizes |
| `Vercel: Rollback Production` | Instantly revert production to a previous deployment |
| `Vercel: Pull Environment Variables` | Pull cloud variables into `.env` |
| `Vercel: Compare Environments` | Diff variables across Preview and Production |
| `Vercel: Diagnose Deployment` | Analyze build failure causes and suggested fixes |
| `Vercel: Detect Configuration Drift` | Compare local `vercel.json` vs cloud configuration |
| `Vercel: Feature Support` | Audit platform capabilities and dashboard fallbacks |

---

## Configuration

| Setting | Default | Description |
| :--- | :--- | :--- |
| `vercel.autoRefresh` | `true` | Periodically update deployment and project state |
| `vercel.refreshInterval` | `30` | Interval in seconds between auto-refreshes |
| `vercel.showNotifications` | `"important"` | Notification level (`all`, `important`, `none`) |
| `vercel.ai.enabled` | `true` | Enable AI-powered build failure diagnosis |
| `vercel.ai.provider` | `"gemini"` | AI Provider (`gemini`, `openai`, `anthropic`) |
| `vercel.dashboardUrl` | `"https://vercel.com"` | Base URL for Vercel Dashboard links |

---

## License

MIT
