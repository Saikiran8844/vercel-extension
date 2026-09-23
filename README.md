# Vercel Console for Visual Studio Code

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Vercel Console Icon" />
</p>

<p align="center">
  <strong>Production-grade Vercel management, interactive dashboard, deployments, environment variables, domains, live logs, and AI diagnostics directly inside VS Code.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel-control-center">
    <img src="https://img.shields.io/visual-studio-marketplace/v/saikiran-n.vercel-control-center?label=Marketplace&logo=visual-studio-code&color=0070f3" alt="Visual Studio Marketplace Version" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel-control-center">
    <img src="https://img.shields.io/visual-studio-marketplace/i/saikiran-n.vercel-control-center?logo=visual-studio-code&color=10b981" alt="Installs" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel-control-center">
    <img src="https://img.shields.io/visual-studio-marketplace/r/saikiran-n.vercel-control-center?color=f5a623" alt="Rating" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  </a>
  <a href="https://github.com/Saikiran8844/vercel-extension">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?logo=github" alt="GitHub" />
  </a>
</p>

---

## 📥 Installation

Available now on the **Visual Studio Code Marketplace**!

### Method 1: VS Code Quick Open
Press `Ctrl + P` (or `Cmd + P` on macOS) and run:
```bash
ext install saikiran-n.vercel-control-center
```

### Method 2: Extensions View
1. Open VS Code and open the Extensions view (`Ctrl + Shift + X` / `Cmd + Shift + X`).
2. Search for **`Vercel Console`** (or **`saikiran-n.vercel-control-center`**).
3. Click **Install**.

### Method 3: Web Marketplace
Install directly from the [Visual Studio Marketplace Listing](https://marketplace.visualstudio.com/items?itemName=saikiran-n.vercel-control-center).

---

## ⚡ What is Vercel Console?

**Vercel Console** brings the complete Vercel developer experience into Visual Studio Code. Monitor live deployments, inspect real-time logs, manage encrypted environment variables, assign custom domains, audit configuration drift, and trigger instant builds without ever switching windows.

> **Note**: This is an open-source community extension designed for developers using Vercel. It is not officially affiliated with or endorsed by Vercel Inc.

---

## 🚀 Key Highlights

### 🖥️ 1. Interactive Control Center Dashboard
A native, high-performance webview interface styled with Vercel's signature dark aesthetic:
- **Instant Project Overview**: Real-time production status indicator, live deployment URLs, commit hashes, active branch, and deployment age.
- **Tabbed Navigation**:
  - **Overview**: Live production card and project metadata with zero-delay instant rendering.
  - **Deployments**: Chronological deployment history with status pills, commit messages, and one-click build log inspection.
  - **Environment Variables**: View encrypted variable keys, masked values, assigned targets (`Production`, `Preview`, `Development`), and delete variables with immediate deployment prompts.
  - **Domains & DNS**: Project domain verification status, apex records, direct links, and account-wide domain assignment.
  - **AI Diagnostics**: Deep health checks scanning for build anomalies, misconfigurations, and environment drift.
- **Project Switcher & Git Importer**: Switch between connected projects on the fly, or import a repository directly from GitHub, GitLab, or Bitbucket.

---

### 🌲 2. Activity Bar Tree Views
Dedicated Vercel explorer in your VS Code side panel featuring:
- **Current Project**: Active project state, framework, and linked workspace path.
- **Deployments**: Grouped by target environment with real-time status badges, rollback, redeploy, and cancel controls.
- **Environment Variables**: Masked values (`••••••••`), CLI push/pull synchronization, and environment comparison diffing.
- **Domains & DNS**: SSL validation, DNS verification status, and one-click diagnostic checks.
- **All Projects & Teams**: Multi-tenant team switcher with instant project search.
- **Platform Services**: Observability into Vercel Blob, Queues, AI Gateway, WAF managed rules, and BotID.

---

### 🔍 3. AI & Deterministic Diagnostics
- **Drift Detection**: Compares local workspace configuration (`vercel.json`, root directory, framework settings) against the remote Vercel cloud project to catch configuration divergence before deploying.
- **AI Build Error Diagnosis**: Automatically parses build and runtime failure logs using Gemini, OpenAI, or Anthropic to suggest precise, actionable code and configuration fixes.
- **Credential Sanitization**: Strictly sanitizes logs and environment payloads before diagnosis to prevent token or secret leakage.

---

### 🛡️ 4. Zero Token Leakage Security
- Authentication credentials and Personal Access Tokens are securely stored in VS Code's encrypted native `SecretStorage`.
- Secrets and tokens are **never** stored in plaintext, workspace files, or `settings.json`.

---

## 🛠️ Getting Started in 3 Steps

1. **Open the Control Center**:
   - Click the **Vercel** icon in the Activity Bar.
   - Or press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) and run `Vercel: Open Control Center Dashboard`.
2. **Connect your Account**:
   - Click **Connect Account** and enter your Vercel Personal Access Token ([Generate a Token here](https://vercel.com/account/tokens)).
3. **Link your Workspace**:
   - Pick any existing project from your account or import a new one from Git.

---

## ⌨️ Command Palette Reference

| Command | Identifier | Description |
| :--- | :--- | :--- |
| **Vercel: Open Control Center Dashboard** | `vercel.openDashboardPanel` | Opens the full interactive webview dashboard |
| **Vercel: Login** | `vercel.login` | Securely store your Vercel Access Token |
| **Vercel: Logout** | `vercel.logout` | Remove saved credentials and reset session |
| **Vercel: Switch Team / Scope** | `vercel.switchAccount` | Switch between Personal account and Teams |
| **Vercel: Deploy** | `vercel.deploy` | Trigger a new deployment for the workspace |
| **Vercel: Deploy Preview** | `vercel.deployPreview` | Deploy preview build with isolated URL |
| **Vercel: Deploy Production** | `vercel.deployProd` | Deploy directly to the live production domain |
| **Vercel: Deploy Dry Run** | `vercel.deployDryRun` | Preview files, ignore rules, and payload size |
| **Vercel: Rollback Production** | `vercel.rollback` | Instantly revert production to a previous deployment |
| **Vercel: Pull Environment Variables** | `vercel.pullEnv` | Download remote cloud environment variables to `.env.local` |
| **Vercel: Compare Environments** | `vercel.compareEnvironments` | Diff variables across Preview and Production |
| **Vercel: Diagnose Deployment** | `vercel.diagnoseDeployment` | Run automated build failure & runtime diagnosis |
| **Vercel: Detect Configuration Drift** | `vercel.detectDrift` | Audit local workspace vs cloud settings |

---

## ⚙️ Configuration Settings

Customize behavior via VS Code Settings (`Ctrl+,` / `Cmd+,` → search `Vercel`):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `vercel.autoRefresh` | `true` | Automatically sync deployment and project status |
| `vercel.refreshInterval` | `30` | Polling interval in seconds for background refreshes |
| `vercel.showNotifications` | `"important"` | Notification filter level (`all`, `important`, `none`) |
| `vercel.ai.enabled` | `true` | Enable intelligent AI diagnosis for build errors |
| `vercel.ai.provider` | `"gemini"` | AI model provider (`gemini`, `openai`, `anthropic`) |
| `vercel.dashboardUrl` | `"https://vercel.com"` | Base URL used for dashboard and external links |
| `vercel.enableTelemetry` | `false` | Anonymous extension performance telemetry |

---

## 🤝 Contributing & Development

```bash
# Clone the repository
git clone https://github.com/Saikiran8844/vercel-extension.git
cd vercel-extension

# Install dependencies
npm install

# Run TypeScript compilation
npm run compile

# Run tests
npm test

# Build production bundle
npm run build
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
