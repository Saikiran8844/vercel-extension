# Vercel Platform Inventory & Capability Audit

A comprehensive inventory of the modern Vercel platform capabilities, API surfaces, CLI commands, and extension integration strategies.

---

## 1. Deployments & Compute

### Deployments
- **Description**: Atomic, immutable deployments created from Git pushes, CLI commands, or REST API calls. Each deployment has a unique URL, build status, environment, and runtime metadata.
- **Official Documentation**: [https://vercel.com/docs/deployments/overview](https://vercel.com/docs/deployments/overview)
- **REST API Availability**:
  - List Deployments: `GET /v6/deployments`
  - Get Deployment: `GET /v13/deployments/{idOrUrl}`
  - Create Deployment: `POST /v13/deployments`
  - Cancel Deployment: `PATCH /v12/deployments/{id}/cancel`
  - Rollback Deployment: `POST /v9/projects/{projectId}/rollback/{deploymentId}`
  - List Deployment Files: `GET /v6/deployments/{id}/files`
  - Get File Content: `GET /v7/deployments/{id}/files/{fileId}`
- **SDK Availability**: Supported via `@vercel/sdk` (`vercel.deployments.*`).
- **CLI Availability**: `vercel deploy [--prod] [--prebuilt]`, `vercel rollback`, `vercel inspect`, `vercel redeploy`, `vercel rm`.
- **Plan Restrictions**: Unlimited deployments on Hobby/Pro; Enterprise includes custom retention and concurrency controls.
- **Extension Strategy**: Native `DeploymentsTreeDataProvider`, status badges (`QUEUED`, `BUILDING`, `READY`, `ERROR`, `CANCELED`), quick actions for inspect, redeploy, rollback, cancel, copy URL, and dry-run file inspection.

### Fluid Compute
- **Description**: Default compute execution model optimizing function concurrency, allowing single serverless instances to serve multiple concurrent requests, reducing cold starts and compute billing.
- **Official Documentation**: [https://vercel.com/docs/functions/fluid-compute](https://vercel.com/docs/functions/fluid-compute)
- **REST API Availability**: Project configuration endpoint `GET /v9/projects/{id}` returns `fluidCompute` settings; deployment metadata returns active CPU & billable duration.
- **SDK Availability**: Supported in project configuration schemas.
- **CLI Availability**: Configured via `vercel.json` (`functions: { memory, maxDuration }`).
- **Plan Restrictions**: Available on all plans with higher concurrency caps on Pro/Enterprise.
- **Extension Strategy**: Exposed under Project Overview and Functions inspection nodes.

---

## 2. Environment Variables & Configuration

### Environment Variables
- **Description**: Key-value pairs configured per environment (Production, Preview, Development, or Custom Environments), with sensitive/encrypted flags.
- **Official Documentation**: [https://vercel.com/docs/projects/environment-variables](https://vercel.com/docs/projects/environment-variables)
- **REST API Availability**:
  - List Project Env: `GET /v9/projects/{idOrName}/env` (or `/v10/projects/{idOrName}/env?decrypt=true`)
  - Create Env Var: `POST /v10/projects/{idOrName}/env`
  - Edit Env Var: `PATCH /v10/projects/{idOrName}/env/{envId}`
  - Delete Env Var: `DELETE /v9/projects/{idOrName}/env/{envId}`
- **SDK Availability**: Supported via `vercel.projects.getProjectEnv`, `vercel.projects.createProjectEnv`.
- **CLI Availability**: `vercel env ls`, `vercel env add`, `vercel env rm`, `vercel env pull [filename]`.
- **Plan Restrictions**: 100 on Hobby, higher on Pro/Enterprise. Sensitive values require owner/admin permissions.
- **Extension Strategy**: Native `EnvironmentTreeDataProvider`, secure masking (`••••••••`), Pull/Push integration via CLI, Environment comparison matrix (Preview vs Production).

---

## 3. Domains & Networking

### Custom Domains & DNS
- **Description**: Custom domain management, SSL certificate provisioning, DNS verification, and apex-to-subdomain redirect rules.
- **Official Documentation**: [https://vercel.com/docs/projects/domains](https://vercel.com/docs/projects/domains)
- **REST API Availability**:
  - List Project Domains: `GET /v9/projects/{idOrName}/domains`
  - Add Domain: `POST /v9/projects/{idOrName}/domains`
  - Remove Domain: `DELETE /v9/projects/{idOrName}/domains/{domain}`
  - Verify Domain: `POST /v9/projects/{idOrName}/domains/{domain}/verify`
  - Get Domain DNS Records: `GET /v6/domains/records`
- **SDK Availability**: Supported via `vercel.domains.*`.
- **CLI Availability**: `vercel domains ls`, `vercel domains add`, `vercel dns ls`, `vercel dns add`.
- **Plan Restrictions**: Custom apex domains and Wildcards supported across plans.
- **Extension Strategy**: Domains tree node with SSL verification badges, DNS conflict diagnosis, and "Diagnose DNS" command with clear A / CNAME instructions.

---

## 4. Observability & Logs

### Build & Runtime Logs
- **Description**: Real-time event streams during deployment compilation and live execution logs with status codes, request IDs, latency, and error traces.
- **Official Documentation**: [https://vercel.com/docs/observability/runtime-logs](https://vercel.com/docs/observability/runtime-logs)
- **REST API Availability**:
  - Build Events: `GET /v3/deployments/{idOrUrl}/events`
  - Runtime Logs: `GET /v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs`
- **SDK Availability**: Build events stream supported.
- **CLI Availability**: `vercel logs [deployment-url]`.
- **Plan Restrictions**: Log retention 1 hour (Hobby), 1 day (Pro), up to 30 days (Enterprise).
- **Extension Strategy**: VS Code `OutputChannel` + interactive Webview log viewer with filters (request ID, status code, route, search term) and AI error explanation.

### Speed Insights & Web Analytics
- **Description**: Core Web Vitals (LCP, INP, CLS, TTFB) and visitor traffic tracking without third-party tracking scripts.
- **Official Documentation**: [https://vercel.com/docs/analytics](https://vercel.com/docs/analytics)
- **REST API Availability**: Project dashboard metadata. Detailed aggregated timeseries exposed via dashboard.
- **SDK Availability**: Basic project enablement settings.
- **CLI Availability**: N/A.
- **Plan Restrictions**: Pro / Enterprise for advanced metrics.
- **Extension Strategy**: Summary badge in Project Overview + deep link to Vercel Analytics dashboard.

---

## 5. Security & Protection

### Web Application Firewall (WAF) & Managed Rules
- **Description**: Custom firewall rules, IP block/bypass lists, rate limiting, and managed OWASP rulesets (SQLi, XSS, Scanner Detection, LFI/RFI, RCE).
- **Official Documentation**: [https://vercel.com/docs/security/vercel-waf](https://vercel.com/docs/security/vercel-waf)
- **REST API Availability**:
  - Get Firewall Config: `GET /v1/security/firewall/config`
  - Update Firewall Config: `PATCH /v1/security/firewall/config`
  - Firewall Events: `GET /v1/security/firewall/events`
  - System Bypass: `GET/POST/DELETE /v1/security/firewall/bypass`
- **SDK Availability**: Supported via Security API endpoints.
- **CLI Availability**: Dashboard managed.
- **Plan Restrictions**: Managed rules available on Pro & Enterprise.
- **Extension Strategy**: Firewall summary tree, managed rules status view, attack challenge toggle.

### Bot Management & BotID
- **Description**: Distinguish legitimate human traffic from AI scrapers and automated bots using verified bot lists and behavioral heuristics.
- **Official Documentation**: [https://vercel.com/docs/security/bot-management](https://vercel.com/docs/security/bot-management)
- **REST API Availability**: Project security settings.
- **CLI Availability**: Code generation integration.
- **Plan Restrictions**: Pro & Enterprise.
- **Extension Strategy**: BotID configuration status + source-code integration snippets for Next.js / Edge middleware.

---

## 6. Platform Services

### Vercel Blob
- **Description**: Globally distributed object storage for media and static files.
- **REST API**: `https://api.vercel.com/v1/blob`
- **CLI**: `vercel blob [cmd]`
- **Extension Strategy**: Storage explorer tree node and CLI integration.

### Vercel Queues
- **Description**: Serverless message queues for async job scheduling.
- **REST API**: `GET /v1/queues`
- **Extension Strategy**: Queue inspector node + dashboard links.

### AI Gateway
- **Description**: Unified gateway for LLM routing, caching, rate limiting, and observability across 100+ AI models.
- **REST API**: `GET /v1/ai-gateway`
- **Extension Strategy**: Provider status node and configuration links.
