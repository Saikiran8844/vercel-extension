# Security Policy & Threat Model

Security is a first-class requirement for Vercel Control Center.

---

## 1. Guiding Principles

1. **Zero Secret Leakage**:
   - Access tokens are never written to disk in plaintext, logged, or exposed in error messages.
   - Sensitive environment variables are rendered masked (`••••••••`) by default in the UI.
2. **Explicit User Consent for AI & External Services**:
   - No project code or logs are sent to external AI providers (OpenAI, Anthropic, Gemini) without explicit user initiation and confirmation.
   - All logs and error messages undergo aggressive redaction (stripping Authorization headers, API keys, passwords, bearer tokens, JWTs, and database URLs) before reaching the AI adapter.
3. **No Silent Destructive Actions**:
   - Rollbacks, project deletions, firewall rule changes, and environment variable deletions always require explicit modal confirmations.
4. **Least Privilege API Requests**:
   - Requests only query required endpoints with appropriate team scoping.

---

## 2. Token Redaction & Sanitization Rules

The extension runs all outbound diagnostic payloads through `src/ai/logSanitizer.ts`:
- Bearer tokens: `Bearer [A-Za-z0-9_-]+` -> `Bearer [REDACTED]`
- Database connection strings: `(postgres|mysql|mongodb)://[^:]+:[^@]+@` -> `$1://[REDACTED]@`
- Private keys / JWTs: `[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}` -> `[REDACTED_JWT]`
- Common secret keys: `(SECRET|KEY|PASSWORD|TOKEN|AUTH)=([^\s]+)` -> `$1=[REDACTED]`

---

## 3. Telemetry

- Telemetry is disabled by default (`vercel.enableTelemetry: false`).
- If enabled, only anonymous diagnostic counts (e.g. extension activation duration, command execution status) are emitted.
- Project names, repository URLs, deployment URLs, usernames, and file paths are **never** collected.
- VS Code global telemetry settings (`telemetry.telemetryLevel`) are strictly respected.
