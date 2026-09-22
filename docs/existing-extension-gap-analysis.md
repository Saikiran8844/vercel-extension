# Existing Extension Gap Analysis

**Subject**: Comparison between Reference Extension (`weiskopfsodefa/vercel-vscode`) and Target **Vercel Control Center**.

---

## 1. Executive Summary

The reference repository (`weiskopfsodefa/vercel-vscode`) is a lightweight deployment status indicator for VS Code. It comprises approximately 10 TypeScript files and ~300 lines of code. It focuses solely on fetching the latest deployment for a Git branch and rendering an icon in the VS Code status bar.

In contrast, **Vercel Control Center** is an end-to-end developer control plane embedded inside VS Code, delivering project management, environment variables, multi-environment deployments, real-time log streaming, DNS diagnostics, firewall controls, and deterministic diagnostics.

---

## 2. Detailed Dimension Breakdown

| Dimension | `weiskopfsodefa/vercel-vscode` | Vercel Control Center | Critical Defect / Limitation in Baseline |
| :--- | :--- | :--- | :--- |
| **Authentication & Secrets** | Reads `vercelVSCode.accessToken` directly from `vscode.workspace.getConfiguration()`. | Uses `context.secrets` (`SecretStorage`). Supports multi-account, token switching, and validation. | **Security Vulnerability**: Storing tokens in plaintext settings exposes credentials in dotfiles, settings sync, and workspace `.vscode/settings.json`. |
| **Project Linkage** | Reads `.vercel/project.json` in the root workspace folder only. If missing, prompts to run `vercel link`. | Multi-tier detection: `.vercel/project.json`, `vercel.json`, `package.json` frameworks, and monorepos (Turborepo, Nx, pnpm/yarn workspaces). | Breaks on monorepos and subdirectories where `.vercel` is not at root. |
| **Sidebar & Views** | None. Zero TreeDataProviders or custom views contributed to the Activity Bar. | 5 dedicated TreeViews (Current Project, Deployments, Environment Variables, Domains, Projects & Teams). | Developers cannot browse projects, deployments, or settings. |
| **Deployments** | Read-only polling of `/v6/deployments` every 10 seconds via `setInterval`. | Complete deployment manager: Deploy (Preview/Prod), dry-run pre-checks, cancel, redeploy, rollback, inspect, and copy URL. | Uncontrolled fixed polling hammers the Vercel API and ignores rate-limiting or backoff. |
| **Environment Variables** | Not supported. | First-class environment manager: Prod / Preview / Dev / Custom, value masking, CLI pull/push, and environment diffing. | Developers must leave VS Code to view or configure environment variables. |
| **Domains & DNS** | Not supported. | Full domain manager: verification status, DNS records (A/CNAME), SSL status, and automated "Diagnose DNS" guidance. | No DNS conflict or misconfiguration assistance. |
| **Logs** | Not supported. | Live build logs streaming (`/v3/deployments/{id}/events`) & runtime logs (`/v1/.../runtime-logs`) with route/status filters. | Developers must open a web browser to inspect failing builds. |
| **Observability & WAF** | Not supported. | Observability metrics (latency, billable duration, requests) + WAF managed rules and security status. | No visibility into platform health or security rules. |
| **Error Handling & Rate Limits** | Minimal `parseError(e)` displaying an alert toast. | Centralized API error handler (401, 403, 404, 429 backoff reading `Retry-After`, 500/503 retry). | Fails completely under rate limits; no token expiration alerts. |
| **AI & Diagnostics** | None. | Deterministic Heuristic Engine + Provider-Agnostic AI Assistant (Gemini / OpenAI / Anthropic) with code correlation. | No automated guidance on why a build failed. |

---

## 3. Architecture Action Plan

### What to Reuse
- Project configuration file pattern (`.vercel/project.json`) for workspace identification (`projectId`, `orgId`).
- Codicon status mapping concept (`pass`, `sync~spin`, `error`).

### What to Refactor
- Status bar item logic: replace unthrottled `setInterval` with adaptive exponential backoff, reactive event emitters, and manual refresh triggers.
- Branch detection: replace synchronous `child_process.exec` with VS Code Git extension API where available, with safe shell fallback.

### What to Remove
- Configuration-based token storage (`vercelVSCode.accessToken`).
- Naive fixed polling loop.

### What to Implement Fresh
- Full Clean Architecture structure (`src/api`, `src/auth`, `src/commands`, `src/providers`, `src/views`, `src/diagnostics`, `src/cli`, `src/types`).
- Capability Registry (`capabilities.ts`) for dynamic feature discovery and dashboard fallbacks.
- Complete TreeViews and Webview views.
- Test suite with mocked Vercel API responses.
