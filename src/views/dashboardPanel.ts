import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VercelClient } from '../api/vercelClient';
import { TokenManager } from '../auth/tokenManager';
import { WorkspaceProjectConfig } from '../types/extension';
import { VercelProject, VercelDeployment, VercelEnvVariable, VercelDomain, VercelTeam, VercelUser } from '../types/vercel';
import { DiagnosticsEngine } from '../diagnostics/diagnosticsEngine';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    client: VercelClient,
    tokenManager: TokenManager,
    getProjectConfig: () => WorkspaceProjectConfig | null,
    onRefresh: () => void
  ): DashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      DashboardPanel.currentPanel.updateData();
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'vercelDashboard',
      'Vercel Control Center',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      client,
      tokenManager,
      getProjectConfig,
      onRefresh
    );

    return DashboardPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly client: VercelClient,
    private readonly tokenManager: TokenManager,
    private readonly getProjectConfig: () => WorkspaceProjectConfig | null,
    private readonly onRefresh: () => void
  ) {
    this.panel = panel;
    this.panel.iconPath = new vscode.ThemeIcon('dashboard');

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );

    this.panel.webview.html = this.getHtml();
    this.updateData();
  }

  public async updateData(): Promise<void> {
    try {
      const token = await this.tokenManager.getAccessToken();
      const activeTeamId = this.tokenManager.getActiveTeamId();
      const projectConfig = this.getProjectConfig();

      if (!token) {
        this.postMessage({
          type: 'state',
          data: {
            authenticated: false,
            activeTeamId,
            projectConfig
          }
        });
        return;
      }

      let user: VercelUser | null = null;
      let teams: VercelTeam[] = [];
      try {
        user = await this.client.auth.getCurrentUser();
        teams = await this.client.auth.getTeams();
      } catch {
        // Token might be invalid
      }

      if (!user) {
        this.postMessage({
          type: 'state',
          data: {
            authenticated: false,
            activeTeamId,
            projectConfig
          }
        });
        return;
      }

      let currentProject: VercelProject | null = null;
      let deployments: VercelDeployment[] = [];
      let envVariables: VercelEnvVariable[] = [];
      let domains: VercelDomain[] = [];
      let availableProjects: VercelProject[] = [];

      if (projectConfig) {
        try {
          currentProject = await this.client.projects.getProject(projectConfig.projectId);
        } catch {
          // Project fetch error
        }

        try {
          deployments = await this.client.deployments.listDeployments(projectConfig.projectId, 15);
        } catch {
          // Deployments fetch error
        }

        try {
          envVariables = await this.client.environment.getEnvVariables(projectConfig.projectId);
        } catch {
          // Env fetch error
        }

        try {
          domains = await this.client.domains.getDomains(projectConfig.projectId);
        } catch {
          // Domains fetch error
        }
      } else {
        try {
          availableProjects = await this.client.projects.listProjects(100);
        } catch {
          // Available projects fetch error
        }
      }

      this.postMessage({
        type: 'state',
        data: {
          authenticated: true,
          user,
          teams,
          activeTeamId,
          projectConfig,
          currentProject,
          deployments,
          envVariables,
          domains,
          availableProjects
        }
      });
    } catch (err) {
      this.postMessage({
        type: 'error',
        message: (err as Error).message
      });
    }
  }

  private async handleMessage(message: { type: string; payload?: Record<string, unknown> }): Promise<void> {
    switch (message.type) {
      case 'login': {
        const token = message.payload?.token as string;
        if (!token) return;
        try {
          await this.tokenManager.setAccessToken(token);
          this.client.invalidateAllCache();
          const user = await this.client.auth.getCurrentUser();
          vscode.window.showInformationMessage(`Logged in as ${user.name || user.username || user.email}!`);
          this.onRefresh();
          await this.updateData();
        } catch (err) {
          vscode.window.showErrorMessage(`Login failed: ${(err as Error).message}`);
        }
        break;
      }

      case 'logout': {
        await this.tokenManager.deleteAccessToken();
        this.client.invalidateAllCache();
        vscode.window.showInformationMessage('Logged out of Vercel.');
        this.onRefresh();
        await this.updateData();
        break;
      }

      case 'switchTeam': {
        const teamId = (message.payload?.teamId as string) || undefined;
        await this.tokenManager.setActiveTeamId(teamId);
        this.client.invalidateAllCache();
        this.onRefresh();
        await this.updateData();
        break;
      }

      case 'linkProject': {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
          vscode.window.showErrorMessage('No workspace folder open.');
          return;
        }

        const project = message.payload?.project as VercelProject;
        if (!project) return;

        try {
          const vercelDir = path.join(root, '.vercel');
          if (!fs.existsSync(vercelDir)) {
            fs.mkdirSync(vercelDir, { recursive: true });
          }

          const projectConfigData = {
            orgId: project.accountId,
            projectId: project.id,
            projectName: project.name
          };

          fs.writeFileSync(
            path.join(vercelDir, 'project.json'),
            JSON.stringify(projectConfigData, null, 2),
            'utf8'
          );

          const gitignorePath = path.join(root, '.gitignore');
          if (fs.existsSync(gitignorePath)) {
            try {
              const content = fs.readFileSync(gitignorePath, 'utf8');
              if (!content.includes('.vercel')) {
                fs.appendFileSync(gitignorePath, '\n.vercel\n', 'utf8');
              }
            } catch {
              // Ignore
            }
          }

          vscode.window.showInformationMessage(`Linked workspace to project "${project.name}"!`);
          this.onRefresh();
          await this.updateData();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to link project: ${(err as Error).message}`);
        }
        break;
      }

      case 'unlinkProject': {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) return;

        const projectJsonPath = path.join(root, '.vercel', 'project.json');
        if (fs.existsSync(projectJsonPath)) {
          fs.unlinkSync(projectJsonPath);
          vscode.window.showInformationMessage('Workspace unlinked from Vercel.');
          this.onRefresh();
          await this.updateData();
        }
        break;
      }

      case 'openTerminalLink': {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) return;
        const terminal = vscode.window.createTerminal({ name: 'Vercel Link', cwd: root });
        terminal.show();
        const activeTeamId = this.tokenManager.getActiveTeamId();
        const teamFlag = activeTeamId ? ` --scope ${activeTeamId}` : '';
        const token = await this.tokenManager.getAccessToken();
        const tokenFlag = token ? ` --token ${token}` : '';
        terminal.sendText(`vercel link${teamFlag}${tokenFlag}`);
        break;
      }

      case 'refresh': {
        this.client.invalidateAllCache();
        this.onRefresh();
        await this.updateData();
        break;
      }

      case 'openUrl': {
        const url = message.payload?.url as string;
        if (url) {
          const finalUrl = url.startsWith('http') ? url : `https://${url}`;
          vscode.env.openExternal(vscode.Uri.parse(finalUrl));
        }
        break;
      }

      case 'deploy': {
        const target = message.payload?.target as 'production' | 'preview';
        if (target === 'production') {
          vscode.commands.executeCommand('vercel.deployProd');
        } else {
          vscode.commands.executeCommand('vercel.deployPreview');
        }
        break;
      }

      case 'addEnv': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        const key = message.payload?.key as string;
        const value = message.payload?.value as string;
        const targets = (message.payload?.targets as ('production' | 'preview' | 'development')[]) || ['production', 'preview', 'development'];

        if (!key || !value) {
          vscode.window.showErrorMessage('Key and Value are required.');
          return;
        }

        try {
          await this.client.environment.createEnvVariable(projectConfig.projectId, {
            key,
            value,
            target: targets,
            type: 'encrypted'
          });
          vscode.window.showInformationMessage(`Environment variable '${key}' created.`);
          await this.updateData();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to create variable: ${(err as Error).message}`);
        }
        break;
      }

      case 'deleteEnv': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        const id = message.payload?.id as string;
        const key = message.payload?.key as string;

        try {
          await this.client.environment.deleteEnvVariable(projectConfig.projectId, id);
          vscode.window.showInformationMessage(`Environment variable '${key}' deleted.`);
          await this.updateData();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to delete variable: ${(err as Error).message}`);
        }
        break;
      }

      case 'pullEnv': {
        vscode.commands.executeCommand('vercel.pullEnv');
        break;
      }

      case 'runDiagnostics': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        try {
          const engine = new DiagnosticsEngine(this.client);
          const diagnostics = await engine.runProjectDiagnostics(projectConfig);
          this.postMessage({
            type: 'diagnosticsResult',
            data: diagnostics
          });
        } catch (err) {
          vscode.window.showErrorMessage(`Diagnostics failed: ${(err as Error).message}`);
        }
        break;
      }

      case 'viewLogs': {
        const deploymentId = message.payload?.deploymentId as string;
        if (deploymentId) {
          vscode.commands.executeCommand('vercel.viewBuildLogs', { id: deploymentId });
        }
        break;
      }
    }
  }

  private postMessage(msg: Record<string, unknown>): void {
    this.panel.webview.postMessage(msg);
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vercel Control Center</title>
  <style>
    :root {
      --bg: #000000;
      --card-bg: rgba(255, 255, 255, 0.04);
      --card-hover: rgba(255, 255, 255, 0.07);
      --card-border: rgba(255, 255, 255, 0.1);
      --card-border-focus: rgba(255, 255, 255, 0.25);
      --text-main: #f5f5f5;
      --text-muted: #888888;
      --text-dim: #555555;
      --vercel-blue: #0070f3;
      --vercel-blue-hover: #0051b3;
      --vercel-cyan: #50e3c2;
      --status-ready: #10b981;
      --status-building: #f5a623;
      --status-error: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist", Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font);
      font-size: 13px;
      line-height: 1.5;
      padding: 0;
      overflow-x: hidden;
    }

    /* Top Navigation Bar */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      background: rgba(10, 10, 10, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }

    .brand svg {
      width: 20px;
      height: 20px;
      fill: #ffffff;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .team-select {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      font-family: var(--font);
      font-size: 12px;
      border-radius: 6px;
      padding: 6px 12px;
      outline: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .team-select:hover {
      border-color: var(--card-border-focus);
      background: rgba(255, 255, 255, 0.09);
    }

    /* Primary and Secondary Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font);
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      text-decoration: none;
    }

    .btn-primary {
      background: #ffffff;
      color: #000000;
    }
    .btn-primary:hover {
      background: #e2e2e2;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--card-border);
      color: var(--text-main);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--card-border-focus);
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
    }

    .btn-sm {
      padding: 4px 10px;
      font-size: 11px;
    }

    /* Main Container */
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    /* State Screens */
    .view-section { display: none; }
    .view-section.active { display: block; animation: fadeIn 0.2s ease-in-out; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Card Component */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      backdrop-filter: blur(8px);
      transition: border-color 0.2s;
    }
    .card:hover {
      border-color: var(--card-border-focus);
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.2px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Auth Screen */
    .login-container {
      max-width: 440px;
      margin: 60px auto;
      text-align: center;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 36px 28px;
    }
    .login-icon {
      margin-bottom: 20px;
    }
    .login-icon svg {
      width: 48px;
      height: 48px;
      fill: #ffffff;
    }
    .login-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .login-subtitle {
      color: var(--text-muted);
      font-size: 13px;
      margin-bottom: 24px;
    }
    .input-group {
      text-align: left;
      margin-bottom: 16px;
    }
    .input-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
      display: block;
    }
    .input-field {
      width: 100%;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      color: #fff;
      font-family: monospace;
      font-size: 13px;
      padding: 10px 12px;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-field:focus {
      border-color: var(--vercel-blue);
    }

    /* Project Linker View */
    .search-box {
      margin-bottom: 20px;
    }
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .project-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .project-card:hover {
      border-color: var(--vercel-blue);
      background: var(--card-hover);
      transform: translateY(-2px);
    }
    .project-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .project-name {
      font-size: 14px;
      font-weight: 600;
    }
    .badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-main);
    }
    .badge-framework {
      background: rgba(0, 112, 243, 0.2);
      color: #79b8ff;
      border: 1px solid rgba(0, 112, 243, 0.3);
    }

    /* Tabs Bar */
    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
    }
    .tab {
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .tab:hover {
      color: var(--text-main);
    }
    .tab.active {
      color: #ffffff;
      border-bottom-color: #ffffff;
    }

    /* Production Live Card */
    .prod-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .prod-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--status-ready);
    }
    .prod-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .prod-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 13px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--status-ready);
      box-shadow: 0 0 10px var(--status-ready);
    }
    .pulse-dot.building {
      background: var(--status-building);
      box-shadow: 0 0 10px var(--status-building);
      animation: pulse 1.2s infinite ease-in-out;
    }
    .pulse-dot.error {
      background: var(--status-error);
      box-shadow: 0 0 10px var(--status-error);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }

    .prod-url {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.4px;
      color: #ffffff;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .prod-url:hover {
      text-decoration: underline;
    }

    .prod-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .meta-item { display: flex; align-items: center; gap: 6px; }

    /* Tables */
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      text-align: left;
      padding: 10px 14px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--text-main);
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Status Pill */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    .status-pill.ready { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .status-pill.building { background: rgba(245, 166, 35, 0.15); color: #fbbf24; }
    .status-pill.error { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    .status-pill.queued { background: rgba(255, 255, 255, 0.1); color: #d1d5db; }

    /* Env variable secret mask */
    .secret-text {
      font-family: monospace;
      color: var(--text-muted);
      user-select: all;
    }

    /* Modal dialog */
    .modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal.active { display: flex; }
    .modal-box {
      background: #111111;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 480px;
    }

    /* Diagnostics Item */
    .diag-item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .diag-item.critical { border-left: 3px solid #ef4444; }
    .diag-item.warning { border-left: 3px solid #f5a623; }
    .diag-item.info { border-left: 3px solid #0070f3; }
  </style>
</head>
<body>

  <!-- Top Header Bar -->
  <div class="topbar">
    <div class="brand">
      <svg viewBox="0 0 116 100" fill="none">
        <path d="M57.5 0L115 100H0L57.5 0Z" fill="white"/>
      </svg>
      <span>Vercel Control Center</span>
    </div>

    <div class="top-actions" id="topActions" style="display: none;">
      <select id="teamSelector" class="team-select" onchange="handleTeamChange(this.value)">
        <option value="">Personal Account</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="sendAction('refresh')">↻ Refresh</button>
      <button class="btn btn-secondary btn-sm" onclick="sendAction('logout')">Log Out</button>
    </div>
  </div>

  <div class="container">

    <!-- 1. NOT AUTHENTICATED VIEW -->
    <div id="viewLogin" class="view-section">
      <div class="login-container">
        <div class="login-icon">
          <svg viewBox="0 0 116 100" fill="none">
            <path d="M57.5 0L115 100H0L57.5 0Z" fill="white"/>
          </svg>
        </div>
        <h2 class="login-title">Connect your Vercel Account</h2>
        <p class="login-subtitle">Enter your Personal Access Token to manage deployments, environment variables, and live observability.</p>

        <div class="input-group">
          <label class="input-label" for="tokenInput">Vercel Access Token</label>
          <input type="password" id="tokenInput" class="input-field" placeholder="Paste token here..." />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="handleLogin()">Connect Account</button>
          <button class="btn btn-secondary" onclick="openExternal('https://vercel.com/account/tokens')">Get Token ↗</button>
        </div>
      </div>
    </div>

    <!-- 2. NOT LINKED VIEW -->
    <div id="viewUnlinked" class="view-section">
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Workspace is not linked</h2>
        <p style="color: var(--text-muted); margin-bottom: 24px;">Link this local workspace to an existing Vercel project or set up a new one.</p>
        <button class="btn btn-secondary" onclick="sendAction('openTerminalLink')">⚡ Run "vercel link" in Terminal</button>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Your Vercel Projects</span>
          <span style="font-size: 12px; color: var(--text-muted);" id="projectCountLabel">0 projects</span>
        </div>
        <div class="search-box">
          <input type="text" id="projectSearchInput" class="input-field" placeholder="Search projects by name..." oninput="filterProjects(this.value)" />
        </div>
        <div class="project-grid" id="projectGrid">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>

    <!-- 3. LINKED DASHBOARD VIEW -->
    <div id="viewDashboard" class="view-section">

      <!-- Navigation Tabs -->
      <div class="tabs">
        <div class="tab active" onclick="switchTab('overview')">Overview</div>
        <div class="tab" onclick="switchTab('deployments')">Deployments</div>
        <div class="tab" onclick="switchTab('environment')">Environment Variables</div>
        <div class="tab" onclick="switchTab('domains')">Domains & DNS</div>
        <div class="tab" onclick="switchTab('diagnostics')">AI Diagnostics</div>
      </div>

      <!-- Tab: Overview -->
      <div id="tabOverview" class="tab-content">
        <!-- Live Production Card -->
        <div class="prod-card" id="prodCard">
          <div class="prod-header">
            <div class="prod-status">
              <span class="pulse-dot" id="prodDot"></span>
              <span id="prodStateText">Production</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="sendAction('deploy', { target: 'production' })">▲ Deploy to Prod</button>
              <button class="btn btn-secondary btn-sm" onclick="sendAction('deploy', { target: 'preview' })">Deploy Preview</button>
            </div>
          </div>
          <a href="#" id="prodLink" class="prod-url" target="_blank" onclick="handleProdClick(event)">app-vercel.app ↗</a>
          <div class="prod-meta">
            <div class="meta-item"><span>Branch:</span> <b id="prodBranch">main</b></div>
            <div class="meta-item"><span>Commit:</span> <span id="prodCommit" style="font-family: monospace;">-</span></div>
            <div class="meta-item"><span>Created:</span> <span id="prodTime">-</span></div>
          </div>
        </div>

        <!-- Project Metadata Card -->
        <div class="card">
          <div class="card-title">
            <span>Project Details</span>
            <button class="btn btn-danger btn-sm" onclick="sendAction('unlinkProject')">Unlink Project</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <span class="input-label">Project Name</span>
              <div id="detailName" style="font-weight: 600; font-size: 14px;">-</div>
            </div>
            <div>
              <span class="input-label">Framework</span>
              <div id="detailFramework"><span class="badge badge-framework">-</span></div>
            </div>
            <div>
              <span class="input-label">Project ID</span>
              <div id="detailId" style="font-family: monospace; color: var(--text-muted);">-</div>
            </div>
            <div>
              <span class="input-label">Root Directory</span>
              <div id="detailRoot" style="font-family: monospace; color: var(--text-muted);">-</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Deployments -->
      <div id="tabDeployments" class="tab-content" style="display: none;">
        <div class="card">
          <div class="card-title">
            <span>Recent Deployments</span>
            <button class="btn btn-primary btn-sm" onclick="sendAction('deploy', { target: 'preview' })">+ New Deployment</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Domain / URL</th>
                  <th>Commit / Message</th>
                  <th>Branch</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="deploymentsTableBody">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Environment Variables -->
      <div id="tabEnvironment" class="tab-content" style="display: none;">
        <div class="card">
          <div class="card-title">
            <span>Environment Variables</span>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="sendAction('pullEnv')">⬇ Pull to .env.local</button>
              <button class="btn btn-primary btn-sm" onclick="openAddEnvModal()">+ Add Variable</button>
            </div>
          </div>
          <div class="search-box">
            <input type="text" id="envSearchInput" class="input-field" placeholder="Filter variables by key..." oninput="filterEnvVars(this.value)" />
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Environments</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="envTableBody">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Domains -->
      <div id="tabDomains" class="tab-content" style="display: none;">
        <div class="card">
          <div class="card-title">
            <span>Custom Domains & DNS</span>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Apex</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="domainsTableBody">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: AI Diagnostics -->
      <div id="tabDiagnostics" class="tab-content" style="display: none;">
        <div class="card">
          <div class="card-title">
            <span>Smart Configuration & Health Diagnostics</span>
            <button class="btn btn-primary btn-sm" onclick="sendAction('runDiagnostics')">⚡ Run Deep Diagnosis</button>
          </div>
          <div id="diagnosticsList">
            <p style="color: var(--text-muted);">Click "Run Deep Diagnosis" to scan for build misconfigurations, drift, and environment issues.</p>
          </div>
        </div>
      </div>

    </div>

  </div>

  <!-- Add Env Modal -->
  <div id="addEnvModal" class="modal">
    <div class="modal-box">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Add Environment Variable</h3>
      <div class="input-group">
        <label class="input-label" for="newEnvKey">Variable Key</label>
        <input type="text" id="newEnvKey" class="input-field" placeholder="e.g. DATABASE_URL, NEXT_PUBLIC_API_URL" />
      </div>
      <div class="input-group">
        <label class="input-label" for="newEnvValue">Variable Value</label>
        <input type="password" id="newEnvValue" class="input-field" placeholder="Value" />
      </div>
      <div class="input-group">
        <label class="input-label">Environments</label>
        <div style="display: flex; gap: 16px; margin-top: 6px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
            <input type="checkbox" id="envTargetProd" checked /> Production
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
            <input type="checkbox" id="envTargetPrev" checked /> Preview
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
            <input type="checkbox" id="envTargetDev" checked /> Development
          </label>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
        <button class="btn btn-secondary" onclick="closeAddEnvModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitNewEnv()">Save Variable</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentState = null;
    let allAvailableProjects = [];
    let allEnvVariables = [];

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'state') {
        renderState(msg.data);
      } else if (msg.type === 'diagnosticsResult') {
        renderDiagnostics(msg.data);
      }
    });

    function sendAction(type, payload = {}) {
      vscode.postMessage({ type, payload });
    }

    function openExternal(url) {
      sendAction('openUrl', { url });
    }

    function handleLogin() {
      const token = document.getElementById('tokenInput').value.trim();
      if (!token) return;
      sendAction('login', { token });
    }

    function handleTeamChange(teamId) {
      sendAction('switchTeam', { teamId });
    }

    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

      const activeTabBtn = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.toLowerCase().includes(tabName));
      if (activeTabBtn) activeTabBtn.classList.add('active');

      const target = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
      if (target) target.style.display = 'block';
    }

    function renderState(data) {
      currentState = data;

      // Handle topbar
      const topActions = document.getElementById('topActions');
      if (data.authenticated) {
        topActions.style.display = 'flex';
        const teamSelector = document.getElementById('teamSelector');
        teamSelector.innerHTML = '<option value="">Personal Account (' + (data.user?.username || data.user?.email || 'User') + ')</option>';
        if (data.teams && data.teams.length) {
          data.teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            if (data.activeTeamId === t.id) opt.selected = true;
            teamSelector.appendChild(opt);
          });
        }
      } else {
        topActions.style.display = 'none';
      }

      // Switch main view sections
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

      if (!data.authenticated) {
        document.getElementById('viewLogin').classList.add('active');
        return;
      }

      if (!data.projectConfig) {
        document.getElementById('viewUnlinked').classList.add('active');
        allAvailableProjects = data.availableProjects || [];
        renderProjectList(allAvailableProjects);
        return;
      }

      // Main Dashboard View
      document.getElementById('viewDashboard').classList.add('active');
      renderDashboard(data);
    }

    function renderProjectList(projects) {
      const grid = document.getElementById('projectGrid');
      const countLabel = document.getElementById('projectCountLabel');
      countLabel.textContent = projects.length + ' projects';
      grid.innerHTML = '';

      if (!projects.length) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No projects found under this account scope.</p>';
        return;
      }

      projects.forEach(p => {
        const div = document.createElement('div');
        div.className = 'project-card';
        div.onclick = () => sendAction('linkProject', { project: p });
        div.innerHTML = \`
          <div>
            <div class="project-card-header">
              <span class="project-name">\${escapeHtml(p.name)}</span>
              <span class="badge badge-framework">\${escapeHtml(p.framework || 'Other')}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">ID: \${escapeHtml(p.id)}</div>
          </div>
          <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-dim);">\${p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}</span>
            <button class="btn btn-primary btn-sm">Link Project →</button>
          </div>
        \`;
        grid.appendChild(div);
      });
    }

    function filterProjects(q) {
      const query = q.toLowerCase();
      const filtered = allAvailableProjects.filter(p => p.name.toLowerCase().includes(query) || (p.framework && p.framework.toLowerCase().includes(query)));
      renderProjectList(filtered);
    }

    function renderDashboard(data) {
      const p = data.currentProject;
      const cfg = data.projectConfig;

      document.getElementById('detailName').textContent = p?.name || cfg?.projectName || '-';
      document.getElementById('detailFramework').innerHTML = \`<span class="badge badge-framework">\${escapeHtml(p?.framework || cfg?.framework || 'Custom')}</span>\`;
      document.getElementById('detailId').textContent = p?.id || cfg?.projectId || '-';
      document.getElementById('detailRoot').textContent = cfg?.rootPath || '-';

      // Live Production Card
      const latest = (data.deployments && data.deployments[0]) || null;
      const prodDot = document.getElementById('prodDot');
      const prodStateText = document.getElementById('prodStateText');
      const prodLink = document.getElementById('prodLink');

      if (latest) {
        prodDot.className = 'pulse-dot ' + (latest.state === 'BUILDING' || latest.state === 'QUEUED' ? 'building' : latest.state === 'ERROR' ? 'error' : '');
        prodStateText.textContent = 'Production (' + latest.state + ')';
        prodLink.textContent = (latest.url || 'app-vercel.app') + ' ↗';
        prodLink.dataset.url = latest.url;
        document.getElementById('prodBranch').textContent = latest.meta?.githubCommitRef || latest.meta?.gitlabCommitRef || 'main';
        document.getElementById('prodCommit').textContent = latest.meta?.githubCommitSha ? latest.meta.githubCommitSha.substring(0, 7) : (latest.meta?.commitMessage ? latest.meta.commitMessage.substring(0, 30) : '-');
        document.getElementById('prodTime').textContent = latest.createdAt ? new Date(latest.createdAt).toLocaleTimeString() : '-';
      }

      // Render Deployments Table
      const depBody = document.getElementById('deploymentsTableBody');
      depBody.innerHTML = '';
      if (data.deployments && data.deployments.length) {
        data.deployments.forEach(d => {
          const tr = document.createElement('tr');
          const stateClass = d.state ? d.state.toLowerCase() : 'ready';
          tr.innerHTML = \`
            <td><span class="status-pill \${stateClass}">\${escapeHtml(d.state || 'READY')}</span></td>
            <td><a href="#" style="color: #fff; text-decoration: none;" onclick="openExternal('\${d.url}')">\${escapeHtml(d.url || '-')} ↗</a></td>
            <td>\${escapeHtml(d.meta?.githubCommitMessage || d.meta?.commitMessage || '-')}</td>
            <td>\${escapeHtml(d.meta?.githubCommitRef || 'main')}</td>
            <td>\${d.createdAt ? new Date(d.createdAt).toLocaleTimeString() : '-'}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="sendAction('viewLogs', { deploymentId: '\${d.id}' })">Logs</button>
            </td>
          \`;
          depBody.appendChild(tr);
        });
      } else {
        depBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No deployments found</td></tr>';
      }

      // Render Env Vars
      allEnvVariables = data.envVariables || [];
      renderEnvVars(allEnvVariables);

      // Render Domains
      const domBody = document.getElementById('domainsTableBody');
      domBody.innerHTML = '';
      if (data.domains && data.domains.length) {
        data.domains.forEach(dom => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><b style="color: #fff;">\${escapeHtml(dom.name)}</b></td>
            <td>\${dom.apexName ? escapeHtml(dom.apexName) : '-'}</td>
            <td><span class="status-pill \${dom.verified ? 'ready' : 'error'}">\${dom.verified ? 'VERIFIED' : 'PENDING'}</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="openExternal('\${dom.name}')">Visit ↗</button></td>
          \`;
          domBody.appendChild(tr);
        });
      } else {
        domBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No custom domains configured</td></tr>';
      }
    }

    function renderEnvVars(vars) {
      const envBody = document.getElementById('envTableBody');
      envBody.innerHTML = '';
      if (vars.length) {
        vars.forEach(v => {
          const tr = document.createElement('tr');
          const targets = Array.isArray(v.target) ? v.target.join(', ') : (v.target || 'all');
          tr.innerHTML = \`
            <td><b style="color: #fff; font-family: monospace;">\${escapeHtml(v.key)}</b></td>
            <td><span class="secret-text">••••••••••••</span></td>
            <td><span class="badge">\${escapeHtml(targets)}</span></td>
            <td>\${v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="sendAction('deleteEnv', { id: '\${v.id}', key: '\${v.key}' })">Delete</button>
            </td>
          \`;
          envBody.appendChild(tr);
        });
      } else {
        envBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No environment variables found</td></tr>';
      }
    }

    function filterEnvVars(q) {
      const query = q.toLowerCase();
      const filtered = allEnvVariables.filter(v => v.key.toLowerCase().includes(query));
      renderEnvVars(filtered);
    }

    function handleProdClick(e) {
      e.preventDefault();
      const url = e.currentTarget.dataset.url;
      if (url) openExternal(url);
    }

    function openAddEnvModal() {
      document.getElementById('addEnvModal').classList.add('active');
    }
    function closeAddEnvModal() {
      document.getElementById('addEnvModal').classList.remove('active');
    }
    function submitNewEnv() {
      const key = document.getElementById('newEnvKey').value.trim();
      const value = document.getElementById('newEnvValue').value.trim();
      const targets = [];
      if (document.getElementById('envTargetProd').checked) targets.push('production');
      if (document.getElementById('envTargetPrev').checked) targets.push('preview');
      if (document.getElementById('envTargetDev').checked) targets.push('development');

      if (!key || !value) return;
      sendAction('addEnv', { key, value, targets });
      closeAddEnvModal();
      document.getElementById('newEnvKey').value = '';
      document.getElementById('newEnvValue').value = '';
    }

    function renderDiagnostics(items) {
      const container = document.getElementById('diagnosticsList');
      container.innerHTML = '';
      if (!items || !items.length) {
        container.innerHTML = '<p style="color: var(--status-ready); font-weight: 600;">✓ All checks passed! No configuration drift or build errors detected.</p>';
        return;
      }

      items.forEach(d => {
        const div = document.createElement('div');
        const sev = (d.severity || 'info').toLowerCase();
        div.className = 'diag-item ' + sev;
        div.innerHTML = \`
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <b style="color: #fff;">\${escapeHtml(d.problem)}</b>
            <span class="status-pill \${sev}">\${escapeHtml(d.severity)}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">\${escapeHtml(d.evidence || '')}</div>
          <div style="background: rgba(255, 255, 255, 0.04); padding: 8px 12px; border-radius: 6px; font-size: 12px;">
            <b style="color: var(--vercel-cyan);">Suggested Fix:</b> \${escapeHtml(d.suggestedFix)}
          </div>
        \`;
        container.appendChild(div);
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>`;
  }
}
