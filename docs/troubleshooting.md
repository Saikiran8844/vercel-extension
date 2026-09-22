# Troubleshooting Guide

Common issues encountered when working with Vercel Control Center and how to resolve them.

---

## 1. Authentication & Token Issues

### "Invalid or Expired Personal Access Token"
- **Cause**: The token entered does not exist or was revoked in Vercel Account Settings.
- **Resolution**:
  1. Open [https://vercel.com/account/tokens](https://vercel.com/account/tokens).
  2. Create a new token with appropriate scope (Full Account or Team access).
  3. In VS Code, execute `Vercel: Login` and paste the new token.

### "You do not have permission for this operation" (HTTP 403)
- **Cause**: The current token is scoped to personal projects, but you are attempting an action in a team workspace, or your role is "Viewer".
- **Resolution**:
  - Run `Vercel: Switch Team / Scope` to switch to the correct team.
  - Verify your team role in Vercel Dashboard (requires Member/Admin/Owner for deployments and environment changes).

---

## 2. Project Detection & Linkage

### "Workspace not linked to a Vercel Project"
- **Cause**: `.vercel/project.json` is missing in the workspace root or subfolder.
- **Resolution**:
  - Run `Vercel: Link Project` from the Command Palette or click "Link Project" in the Current Project view.
  - Alternatively, run `vercel link` in your workspace terminal.

### Monorepo Subpackage Not Recognized
- **Resolution**:
  - Ensure the target package has a `package.json` and optionally a `vercel.json` or `.vercel/project.json`.
  - The extension scans workspace folders and subdirectories up to 3 levels deep for monorepos.

---

## 3. Rate Limiting (HTTP 429)

- **Cause**: Frequent polling or extensive parallel queries exceeded Vercel API limits.
- **Behavior**: The extension automatically queues requests and pauses polling based on the `Retry-After` header.
- **Resolution**: Adjust `vercel.refreshInterval` in VS Code settings (default 30 seconds).
