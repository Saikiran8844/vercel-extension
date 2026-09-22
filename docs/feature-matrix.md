# Vercel Control Center: Feature Matrix

This matrix tracks the level of support across Vercel platform capabilities, API availability, CLI commands, and extension implementation status.

**Legend**:
- ✓ **Fully Supported**: First-class native integration in the extension.
- ◐ **Partially Supported**: Core operations supported natively; advanced operations via CLI/API.
- → **Dashboard Fallback**: Direct context-aware navigation to Vercel Web Dashboard.
- — **Not Available**: Capability is not exposed outside internal infrastructure.

---

| Category | Capability | REST API | CLI | Extension Status | Dashboard Fallback | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Authentication** | Personal Access Token | ✓ | ✓ | ✓ | | Stored securely in `SecretStorage` |
| | Team Switching & Scopes | ✓ | ✓ | ✓ | | Multi-team switcher QuickPick |
| | Token Validation & Permissions | ✓ | ✓ | ✓ | | RBAC permission detection |
| **Projects** | Auto-detect Project | — | ✓ | ✓ | | Detects `.vercel/project.json` & monorepos |
| | Link Local Directory | — | ✓ | ✓ | | Calls `vercel link` or creates `.vercel` |
| | Project Browser (All Projects) | ✓ | ✓ | ✓ | → | Search and filter by team |
| | Project Settings | ◐ | ◐ | ◐ | → | General, Framework, Build commands |
| | Configuration Drift Detection | — | — | ✓ | | Compares local files vs Vercel config |
| **Deployments** | Deployment List & Filter | ✓ | ✓ | ✓ | → | Production, Preview, Custom branches |
| | Deploy (Preview / Prod) | ✓ | ✓ | ✓ | | Via CLI or direct upload API |
| | Dry Run File Inspection | — | ✓ | ✓ | | Preview included/ignored files & size |
| | Redeploy & Rollback | ✓ | ✓ | ✓ | → | Instant rollback to previous deployment |
| | Cancel In-Progress Build | ✓ | — | ✓ | → | `PATCH /v12/deployments/{id}/cancel` |
| | Build & Runtime Logs | ✓ | ✓ | ✓ | → | Live streaming and filtering |
| **Environments** | Environment Variables Matrix | ✓ | ✓ | ✓ | → | Production, Preview, Development |
| | Masked Sensitive Values | ✓ | — | ✓ | | Values hidden (`••••••••`) by default |
| | Pull & Push Variables | — | ✓ | ✓ | | Integrated with `vercel env pull/push` |
| | Environment Comparison Diff | — | — | ✓ | | Compare variables across environments |
| **Domains & DNS** | List & Add Domains | ✓ | ✓ | ✓ | → | Project custom domains |
| | Verification & SSL Status | ✓ | — | ✓ | → | Real-time verification trigger |
| | DNS Records & Diagnostics | ✓ | ✓ | ✓ | → | Actionable guidance for A/CNAME misconfigs |
| **Observability** | Latency, Requests, Bandwidth | ◐ | — | ◐ | → | Key metrics in overview node |
| | Speed Insights & Vitals | ◐ | — | ◐ | → | Core Web Vitals summary card |
| **Security & WAF** | Firewall Custom & Managed Rules | ✓ | — | ◐ | → | OWASP rulesets and IP bypass |
| | BotID & Bot Management | ◐ | — | ◐ | → | Bot detection status + code helper |
| | Deployment Protection | ✓ | — | ◐ | → | Password, SSO, and IP restrictions |
| **Platform Services** | Vercel Blob | ✓ | ✓ | ◐ | → | Storage explorer & file listing |
| | Vercel Queues | ◐ | — | ◐ | → | Queue status and backlog inspection |
| | AI Gateway | ◐ | — | ◐ | → | Model routing status and config link |
| | Sandboxes & Workflows | ◐ | — | ◐ | → | Status nodes + documentation links |
| **Diagnostics & AI**| Deterministic Engine | — | — | ✓ | | Heuristic check for missing env, DNS, build |
| | AI Log & Build Explainer | — | — | ✓ | | Provider-agnostic (Gemini, Claude, GPT) |
