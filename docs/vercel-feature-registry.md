# Vercel Feature Registry

This document tracks newly released and established Vercel platform capabilities, API endpoints, CLI commands, and extension status.

---

| Feature | Date Discovered | Vercel Doc URL | API Endpoint | CLI Command | Extension Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Deployments** | Baseline | [Docs](https://vercel.com/docs/deployments) | `/v6/deployments`, `/v13/deployments/{id}` | `vercel deploy` | Supported (Tree & Webview) |
| **Instant Rollback** | Baseline | [Docs](https://vercel.com/docs/deployments/instant-rollback) | `POST /v9/projects/{id}/rollback/{depId}` | `vercel rollback` | Supported |
| **Fluid Compute** | Modern | [Docs](https://vercel.com/docs/functions/fluid-compute) | `/v9/projects/{id}` settings | `vercel.json` | Supported (Inspector) |
| **Runtime Logs** | Baseline | [Docs](https://vercel.com/docs/observability/runtime-logs) | `/v1/projects/{proj}/deployments/{dep}/runtime-logs` | `vercel logs` | Supported (Log Viewer) |
| **Build Events Stream**| Baseline | [Docs](https://vercel.com/docs/rest-api) | `/v3/deployments/{id}/events` | `vercel logs` | Supported (Streaming) |
| **WAF / Managed Rules**| Modern | [Docs](https://vercel.com/docs/security/vercel-waf) | `/v1/security/firewall/config` | Dashboard | Supported (Security view) |
| **BotID** | Modern | [Docs](https://vercel.com/docs/security/bot-management) | Security settings | Dashboard | Supported (Status & Snippets) |
| **Blob Storage** | Modern | [Docs](https://vercel.com/docs/storage/vercel-blob) | `/v1/blob` | `vercel blob` | Supported (Platform view) |
| **AI Gateway** | Modern | [Docs](https://vercel.com/docs/ai/ai-gateway) | `/v1/ai-gateway` | Dashboard | Supported (Platform view) |
| **Vercel Workflow** | Modern | [Docs](https://vercel.com/docs/workflow) | Event-sourced runtime | Dashboard | Supported (Platform view) |
| **Vercel Sandbox** | Modern | [Docs](https://vercel.com/docs/sandbox) | Container sandboxes | Dashboard | Supported (Platform view) |
| **Vercel Queues** | Modern | [Docs](https://vercel.com/docs/queues) | `/v1/queues` | Dashboard | Supported (Platform view) |
