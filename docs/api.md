# Vercel REST API Client Architecture

Vercel Control Center utilizes a centralized, typed `VercelClient` to interact with official Vercel REST API endpoints.

---

## 1. Client Architecture

```typescript
export class VercelClient {
  public readonly auth: AuthService;
  public readonly projects: ProjectService;
  public readonly deployments: DeploymentService;
  public readonly environments: EnvironmentService;
  public readonly domains: DomainService;
  public readonly logs: LogService;
  public readonly security: SecurityService;
  public readonly platform: PlatformServices;
}
```

### Core Features
- **Concurrency Rate Limiting**: Max 5 simultaneous HTTP requests to prevent socket exhaustion and API throttling.
- **Rate Limit Resilience**: Reads `x-ratelimit-remaining` and `Retry-After` headers on HTTP 429 and transparently delays retries.
- **In-Memory Caching with TTL**:
  - Deployments: 15s TTL.
  - Projects & Teams: 60s TTL.
  - Domains: 60s TTL.
  - Environment Variables: 30s TTL.
  - Supports Stale-While-Revalidate and manual force-refresh.
- **Centralized Error Dispatch**:
  - `401 Unauthorized` -> Prompts for login.
  - `403 Forbidden` -> Displays missing team/project permissions.
  - `404 Not Found` -> Indicates deleted or inaccessible resource.
  - `429 Too Many Requests` -> Pauses requests until rate limit window resets.
  - `500 / 503 Server Error` -> Retries with exponential backoff up to 3 attempts.

---

## 2. API Endpoint Directory

| Resource | Method | Path | Purpose |
| :--- | :--- | :--- | :--- |
| **User** | `GET` | `/v2/user` | Validate token and fetch user profile |
| **Teams** | `GET` | `/v2/teams` | List affiliated teams |
| **Projects** | `GET` | `/v9/projects` | List projects (scoped to user/team) |
| **Project Details** | `GET` | `/v9/projects/{idOrName}` | Project configuration and git integration |
| **Deployments** | `GET` | `/v6/deployments` | List deployments |
| **Deployment Info**| `GET` | `/v13/deployments/{idOrUrl}` | Deep metadata, creator, git commit, build stats |
| **Cancel** | `PATCH`| `/v12/deployments/{id}/cancel` | Cancel in-progress build |
| **Rollback** | `POST`| `/v9/projects/{id}/rollback/{depId}` | Instant rollback to prior deployment |
| **Env Variables** | `GET` | `/v9/projects/{idOrName}/env` | List project environment variables |
| **Domains** | `GET` | `/v9/projects/{idOrName}/domains` | List domains assigned to project |
| **Domain Verify** | `POST`| `/v9/projects/{id}/domains/{domain}/verify` | Trigger DNS verification |
| **Build Events** | `GET` | `/v3/deployments/{id}/events` | Build log stream |
| **Runtime Logs** | `GET` | `/v1/projects/{proj}/deployments/{dep}/runtime-logs` | Serverless execution logs |
| **Firewall** | `GET` | `/v1/security/firewall/config` | Read project WAF rules |
