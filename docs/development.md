# Development & Contributing Guide

Guide for building, running, and contributing to Vercel Control Center for VS Code.

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **VS Code**: v1.85.0 or higher
- **Vercel CLI** (optional for local deployment and dry-run testing): `npm i -g vercel`

---

## 2. Setup & Build

```bash
# Clone the repository
git clone https://github.com/community/vercel-control-center.git
cd vercel-control-center

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Build extension bundle
npm run build

# Run unit tests
npm run test

# Run linter
npm run lint
```

---

## 3. Debugging inside VS Code

1. Open the repository root folder in VS Code.
2. Press `F5` to start a new **Extension Development Host** window.
3. In the new window, open any workspace folder (e.g. Next.js or Node app linked to Vercel).
4. Run commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), such as:
   - `Vercel: Login`
   - `Vercel: Link Project`
   - `Vercel: Feature Support`
