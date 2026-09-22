# Authentication & Scope Management

Vercel Control Center enforces strict security principles for credential management.

---

## 1. Storage Mechanism: VS Code SecretStorage

Tokens are stored exclusively in the operating system's native keychain via VS Code's `context.secrets` API:
- **macOS**: Keychain
- **Windows**: Windows Credential Manager (DPAPI)
- **Linux**: Secret Service API / libsecret

### Prohibited Storage Patterns
- ❌ VS Code settings (`settings.json` or `.vscode/settings.json`)
- ❌ Workspace `.env` or project files
- ❌ Extension global state or memory dumps
- ❌ Extension logs or console outputs

---

## 2. Supported Authentication Modes

### Personal Access Token (PAT)
- Generated via [Vercel Account Tokens](https://vercel.com/account/tokens).
- Scoped to user account and all permitted teams.
- Validated via `GET /v2/user` on entry.

### Multi-Account & Team Scope
- Users can switch between personal account and any affiliated Vercel teams.
- Active team ID (`teamId`) is passed as a query parameter (`?teamId=...`) across all team-scoped REST API calls.
- Swapping teams updates all TreeViews and current project resolutions reactively.

---

## 3. Commands

- `Vercel: Login`: Prompts for a Personal Access Token via secure password input box, validates it against `/v2/user`, and stores it in `SecretStorage`.
- `Vercel: Logout`: Removes the token from `SecretStorage`, clears cached user metadata, and resets all views.
- `Vercel: Switch Team / Scope`: Displays a QuickPick of all user teams and personal scope.
- `Vercel: Validate Authentication`: Tests the active token and checks API connectivity.
