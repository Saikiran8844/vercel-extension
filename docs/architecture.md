# Architecture & System Design

**Vercel Control Center for VS Code** is built using Clean Architecture principles, ensuring modularity, testability, security, and dynamic capability adaptation.

---

## 1. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                   VS Code Presentation                 │
│  - Activity Bar TreeViews (Project, Deployments, etc.) │
│  - Status Bar Manager (Dynamic backoff polling)        │
│  - Webview View / OutputChannel (Logs & Env Diff)      │
│  - Command Palette Handlers                            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Application Core                    │
│  - ProjectManager & MonorepoDetector                   │
│  - DeploymentEngine (polling, dry-run, rollback)       │
│  - EnvironmentManager & ConfigDriftDetector            │
│  - DeterministicHeuristicEngine (Diagnostics)          │
│  - AIAssistant (Provider-agnostic error explainer)     │
│  - CapabilityRegistry (Dynamic platform adaptation)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               Service & Abstraction Layer              │
│  - VercelClient (HTTP client, queue, backoff, cache)   │
│  - TokenManager (SecretStorage wrapper)                │
│  - VercelCliRunner (CLI execution & dry-run parser)    │
│  - Domain Services (Project, Deployments, Env, WAF)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Infrastructure Layer                  │
│  - Vercel REST API (https://api.vercel.com)            │
│  - VS Code Extension Context & SecretStorage           │
│  - Local Workspace File System & Git                   │
│  - External LLM Endpoints (Gemini / OpenAI / Claude)   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Key Modules & Responsibilities

### Presentation Layer
- **TreeDataProviders**: Provide structured, lazy-loaded representations of the Vercel state:
  - `CurrentProjectTreeDataProvider`: Active workspace project details, branch, status.
  - `DeploymentsTreeDataProvider`: Chronological list of deployments grouped by environment.
  - `EnvironmentTreeDataProvider`: Production, Preview, and Development environment variables with masked values.
  - `DomainsTreeDataProvider`: Domains, SSL badges, verification status.
  - `ProjectsTreeDataProvider`: Global account/team project browser.
  - `TeamsTreeDataProvider`: Team scope and membership.
  - `PlatformServicesTreeDataProvider`: Blob, Queues, AI Gateway, Firewall.
- **StatusBarManager**: Displays dynamic state (`$(cloud) Vercel: Ready`, `$(sync~spin) Vercel: Building`, `$(error) Vercel: Error`) with adaptive polling:
  - 5-10s interval during active deployment builds.
  - 30-60s interval during idle state.
  - Suspended during offline mode.

### Application Core Layer
- **CapabilityRegistry (`src/capabilities.ts`)**: Dynamically determines whether an action should trigger a native REST API call, invoke a CLI command, or launch the Vercel Dashboard fallback (`Open in Vercel Dashboard`).
- **DeterministicHeuristicEngine (`src/diagnostics/diagnosticsEngine.ts`)**: Evaluates workspace state, build errors, missing environment variables, and DNS records using structured rules before invoking any AI.
- **AIAssistant (`src/ai/assistant.ts`)**: Provides error explanations and remediation advice. Sanitizes all inputs (stripping tokens, passwords, and sensitive keys) before sending queries to external LLM providers.

### Service & Abstraction Layer
- **VercelClient (`src/api/client.ts`)**:
  - Implements concurrency-limited request queue (max 5 parallel requests).
  - Handles automatic HTTP 429 rate limit backoff by inspecting `Retry-After`.
  - In-memory cache with TTL and Stale-While-Revalidate support.
  - Centralized error translation:
    - 401 -> `AuthenticationError`
    - 403 -> `PermissionDeniedError`
    - 404 -> `NotFoundError`
    - 429 -> `RateLimitExceededError`
- **TokenManager (`src/auth/tokenManager.ts`)**:
  - Communicates directly with VS Code `SecretStorage`.
  - Never persists credentials in `settings.json`, workspace files, or logs.
  - Manages multiple tokens and active team scope.
- **VercelCliRunner (`src/cli/vercelCli.ts`)**:
  - Spawns local `vercel` CLI commands asynchronously.
  - Supports `--dry` run inspection, `env pull`, `env push`, and `deploy`.

---

## 3. Data Flow: Deployment Lifecycle

1. **Trigger**: Developer clicks `Vercel: Deploy` or `Deploy Preview`.
2. **Pre-check**: Extension runs `vercel deploy --dry` to parse included files and detect oversized assets.
3. **Execution**: If approved, triggers deployment via CLI or REST API.
4. **Polling & Event Streaming**:
   - `StatusBarManager` switches to building state (`$(sync~spin)`).
   - `LogService` streams build events from `/v3/deployments/{id}/events`.
   - Polling frequency accelerates to 5 seconds.
5. **Completion**:
   - On `READY`, notification sent (based on user notification preference), polling drops back to idle interval, status bar updates to ready (`$(cloud)`), and TreeViews refresh.
   - On `ERROR`, notification triggers "Diagnose Deployment" option.
