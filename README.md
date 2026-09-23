# Vercel Console

<p align="center">
  <img src="media/icon.png" width="96" height="96" alt="Vercel Console" />
</p>

<p align="center">
  Manage your Vercel projects, deployments, logs, and environment variables directly inside VS Code — without constantly switching back and forth to your browser.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel">
    <img src="https://img.shields.io/visual-studio-marketplace/v/saikiran-n.vercel?label=Marketplace&logo=visual-studio-code&color=0070f3" alt="Marketplace" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel">
    <img src="https://img.shields.io/visual-studio-marketplace/i/saikiran-n.vercel?logo=visual-studio-code" alt="Installs" />
  </a>
  <a href="https://github.com/Saikiran8844/vercel-extension">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?logo=github" alt="GitHub" />
  </a>
</p>

---

## Why this exists

If you build on Vercel, your daily workflow usually involves:
- Pushing a commit, then opening Chrome to wait for the build to finish.
- Copying environment variables between the dashboard and your `.env.local`.
- Wondering why a preview build failed and digging through web logs to find the line.

**Vercel Console** puts the dashboard inside VS Code so you can stay in your editor and keep coding.

---

## Install

Search for **`Vercel Console`** in the Extensions view (`Ctrl + Shift + X` / `Cmd + Shift + X`), or run:

```bash
ext install saikiran-n.vercel-control-center
```

Or get it directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel).

---

## What you can do

### 1. The Dashboard (`Ctrl+Shift+P` → `Vercel: Open Control Center Dashboard`)
A clean dashboard designed to feel like Vercel's web interface:
- **Live Status**: See if production or preview is building, ready, or failed with real-time indicators.
- **Instant Deploys**: Deploy to preview or production with one click.
- **Deployments Tab**: Browse build history, view commit details, and read logs without opening a browser.
- **Environment Variables**: Add, delete, and inspect variables across Production, Preview, and Development. It even asks if you want to deploy right after adding one so your runtime actually gets the update.
- **Domains & DNS**: Check DNS verification status, visit domains, or hook up domains already attached to your account.
- **Project Switching & Git Import**: Switch between connected projects or spin up a new project straight from a Git repository.

### 2. Sidebar Explorer
Click the Vercel triangle in your activity bar to see:
- Current linked project and framework.
- Recent deployments with status icons.
- Masked environment variables with quick pull-to-local options.
- Team and scope switcher.

### 3. Build Diagnostics & Drift Detection
- Compares your local config (`vercel.json`, root folder, framework) with your remote Vercel settings so you don't get surprises after pushing.
- Optional AI error explanation for build failures (powered by your choice of Gemini, OpenAI, or Claude).
- Your secrets and tokens are never leaked — everything is scrubbed before analysis.

---

## Getting Started (1 minute)

1. Open the dashboard via the sidebar icon or run **`Vercel: Open Control Center Dashboard`** in the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Paste your Vercel Access Token ([generate one here](https://vercel.com/account/tokens) if you don't have one handy).
3. If your workspace already has a `.vercel/project.json`, it links automatically. If not, pick a project from the list or link one.

That's it. Your token is stored safely in VS Code's encrypted secret vault, not in any config file.

---

## Useful Shortcuts & Commands

| Command | What it does |
| :--- | :--- |
| `Vercel: Open Control Center Dashboard` | Opens the full visual dashboard tab |
| `Vercel: Deploy Production` | Deploys active workspace directly to production |
| `Vercel: Deploy Preview` | Creates an isolated preview deployment |
| `Vercel: Pull Environment Variables` | Pulls your remote env vars down to `.env.local` |
| `Vercel: Rollback Production` | Reverts production to an earlier working build |
| `Vercel: Switch Team / Scope` | Switch between your personal account and team accounts |
| `Vercel: Detect Configuration Drift` | Checks if local settings match cloud settings |
| `Vercel: Logout` | Clears stored token and resets extension state |

---

## Settings

You can tweak how the extension behaves in your VS Code settings (`Ctrl+,` → search `Vercel`):

- **`vercel.autoRefresh`**: Automatically poll for deployment updates (default: `true`).
- **`vercel.refreshInterval`**: How often to check for updates in seconds (default: `30`).
- **`vercel.ai.provider`**: Which provider to use for error explanation (`gemini`, `openai`, `anthropic`).

---

## Contributing

Found a bug or have an idea? Issues and PRs are welcome on [GitHub](https://github.com/Saikiran8844/vercel-extension).

```bash
git clone https://github.com/Saikiran8844/vercel-extension.git
cd vercel-extension
npm install
npm run build
```

---

## Disclaimer

This is an independent community project and is not affiliated with, maintained, or endorsed by Vercel Inc.
