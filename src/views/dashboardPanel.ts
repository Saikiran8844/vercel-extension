import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VercelClient } from '../api/vercelClient';
import { TokenManager } from '../auth/tokenManager';
import { WorkspaceProjectConfig } from '../types/extension';
import { VercelProject, VercelDeployment, VercelEnvVariable, VercelDomain, VercelTeam, VercelUser } from '../types/vercel';
import { DiagnosticsEngine } from '../diagnostics/diagnosticsEngine';
import { DriftDetector } from '../project/driftDetector';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private static lastState: Record<string, unknown> | null = null;
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
      const projectConfig = getProjectConfig();
      const activeTeamId = tokenManager.getActiveTeamId();
      const baseline = DashboardPanel.lastState || (projectConfig ? {
        authenticated: true,
        activeTeamId,
        projectConfig,
        currentProject: {
          id: projectConfig.projectId,
          name: projectConfig.projectName,
          framework: projectConfig.framework || 'nextjs'
        },
        deployments: [],
        envVariables: [],
        domains: [],
        accountDomains: [],
        availableProjects: []
      } : null);
      DashboardPanel.currentPanel.panel.webview.html = DashboardPanel.currentPanel.getHtml(baseline);
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

    this.panel.onDidChangeViewState(
      () => {
        if (this.panel.visible) {
          this.updateData();
        }
      },
      null,
      this.disposables
    );

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );

    // Build baseline initial state for instantaneous zero-delay rendering
    const projectConfig = this.getProjectConfig();
    const activeTeamId = this.tokenManager.getActiveTeamId();
    const baseline = DashboardPanel.lastState || (projectConfig ? {
      authenticated: true,
      activeTeamId,
      projectConfig,
      currentProject: {
        id: projectConfig.projectId,
        name: projectConfig.projectName,
        framework: projectConfig.framework || 'nextjs'
      },
      deployments: [],
      envVariables: [],
      domains: [],
      accountDomains: [],
      availableProjects: []
    } : null);

    this.panel.webview.html = this.getHtml(baseline);
    this.updateData();
  }

  public async updateData(): Promise<void> {
    try {
      const token = await this.tokenManager.getAccessToken();
      const activeTeamId = this.tokenManager.getActiveTeamId();
      const projectConfig = this.getProjectConfig();

      if (!token) {
        const unauthState = {
          authenticated: false,
          activeTeamId,
          projectConfig
        };
        DashboardPanel.lastState = unauthState;
        this.postMessage({
          type: 'state',
          data: unauthState
        });
        return;
      }

      // Step 1: Parallel Authentication & Teams fetch
      const [userRes, teamsRes] = await Promise.allSettled([
        this.client.auth.getCurrentUser(),
        this.client.auth.getTeams()
      ]);

      let user: VercelUser | null = null;
      let teams: VercelTeam[] = [];
      if (userRes.status === 'fulfilled') user = userRes.value;
      if (teamsRes.status === 'fulfilled') teams = teamsRes.value;

      if (!user) {
        const unauthState = {
          authenticated: false,
          activeTeamId,
          projectConfig
        };
        DashboardPanel.lastState = unauthState;
        this.postMessage({
          type: 'state',
          data: unauthState
        });
        return;
      }

      // Step 2: High-Performance Concurrent ("Multithreaded") Parallel Data Fetching
      let currentProject: VercelProject | null = null;
      let deployments: VercelDeployment[] = [];
      let envVariables: VercelEnvVariable[] = [];
      let domains: VercelDomain[] = [];
      let availableProjects: VercelProject[] = [];
      let accountDomains: VercelDomain[] = [];

      if (projectConfig) {
        const [
          projResult,
          depsResult,
          envsResult,
          domsResult,
          allProjsResult,
          accDomsResult
        ] = await Promise.allSettled([
          this.client.projects.getProject(projectConfig.projectId),
          this.client.deployments.listDeployments(projectConfig.projectId, 15),
          this.client.environments.listEnvironmentVariables(projectConfig.projectId),
          this.client.domains.listDomains(projectConfig.projectId),
          this.client.projects.listProjects(100),
          this.client.domains.listAllAccountDomains()
        ]);

        if (projResult.status === 'fulfilled') currentProject = projResult.value;
        if (depsResult.status === 'fulfilled') deployments = depsResult.value;
        if (envsResult.status === 'fulfilled') envVariables = envsResult.value;
        if (domsResult.status === 'fulfilled') domains = domsResult.value;
        if (allProjsResult.status === 'fulfilled') availableProjects = allProjsResult.value;
        if (accDomsResult.status === 'fulfilled') accountDomains = accDomsResult.value;
      } else {
        const [allProjsResult, accDomsResult] = await Promise.allSettled([
          this.client.projects.listProjects(100),
          this.client.domains.listAllAccountDomains()
        ]);
        if (allProjsResult.status === 'fulfilled') availableProjects = allProjsResult.value;
        if (accDomsResult.status === 'fulfilled') accountDomains = accDomsResult.value;
      }

      const stateData = {
        authenticated: true,
        user,
        teams,
        activeTeamId,
        projectConfig,
        currentProject,
        deployments,
        envVariables,
        domains,
        accountDomains,
        availableProjects
      };

      DashboardPanel.lastState = stateData;
      this.postMessage({
        type: 'state',
        data: stateData
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
      case 'ready': {
        if (DashboardPanel.lastState) {
          this.postMessage({
            type: 'state',
            data: DashboardPanel.lastState
          });
        }
        await this.updateData();
        break;
      }

      case 'addEnvCli': {
        vscode.commands.executeCommand('vercel.addEnvCli');
        break;
      }

      case 'pullEnv': {
        vscode.commands.executeCommand('vercel.pullEnv');
        break;
      }

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

      case 'createProject': {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
          vscode.window.showErrorMessage('No workspace folder open.');
          return;
        }

        const name = (message.payload?.name as string)?.trim();
        const framework = (message.payload?.framework as string) || undefined;
        const gitUrl = (message.payload?.gitUrl as string)?.trim();

        if (!name) {
          vscode.window.showErrorMessage('Project name is required.');
          return;
        }

        try {
          let gitRepository: { type: string; repo: string } | undefined = undefined;
          if (gitUrl) {
            let repoPath = gitUrl.replace(/\.git$/, '');
            let type = 'github';
            if (repoPath.includes('gitlab.com/')) {
              type = 'gitlab';
              repoPath = repoPath.split('gitlab.com/')[1];
            } else if (repoPath.includes('bitbucket.org/')) {
              type = 'bitbucket';
              repoPath = repoPath.split('bitbucket.org/')[1];
            } else if (repoPath.includes('github.com/')) {
              type = 'github';
              repoPath = repoPath.split('github.com/')[1];
            }
            gitRepository = { type, repo: repoPath };
          }

          const project = await this.client.projects.createProject({
            name,
            framework: framework || null,
            gitRepository
          });

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

          vscode.window.showInformationMessage(`Project "${project.name}" created and linked!`);
          this.onRefresh();
          await this.updateData();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to create project: ${(err as Error).message}`);
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
          await this.client.environments.createEnvironmentVariable(projectConfig.projectId, {
            key,
            value,
            target: targets,
            type: 'encrypted'
          });
          await this.updateData();
          this.onRefresh();

          const deployChoice = await vscode.window.showInformationMessage(
            `Environment variable '${key}' created. Deploy now to apply the new variable?`,
            'Deploy to Production',
            'Deploy to Preview',
            'Later'
          );
          if (deployChoice === 'Deploy to Production') {
            vscode.commands.executeCommand('vercel.deployProd');
          } else if (deployChoice === 'Deploy to Preview') {
            vscode.commands.executeCommand('vercel.deployPreview');
          }
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
          await this.client.environments.deleteEnvironmentVariable(projectConfig.projectId, id);
          vscode.window.showInformationMessage(`Environment variable '${key}' deleted.`);
          await this.updateData();
          this.onRefresh();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to delete variable: ${(err as Error).message}`);
        }
        break;
      }

      case 'pullEnv': {
        vscode.commands.executeCommand('vercel.pullEnv');
        break;
      }

      case 'addDomain': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        const domain = message.payload?.domain as string;
        const redirect = (message.payload?.redirect as string) || undefined;

        if (!domain) {
          vscode.window.showErrorMessage('Domain name is required.');
          return;
        }

        try {
          await this.client.domains.addDomain(projectConfig.projectId, domain, redirect);
          vscode.window.showInformationMessage(`Domain '${domain}' added to project.`);
          await this.updateData();
          this.onRefresh();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to add domain: ${(err as Error).message}`);
        }
        break;
      }

      case 'deleteDomain': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        const domain = message.payload?.domain as string;
        if (!domain) return;

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to remove domain '${domain}' from this project?`,
          { modal: true },
          'Remove Domain'
        );
        if (confirm !== 'Remove Domain') return;

        try {
          await this.client.domains.removeDomain(projectConfig.projectId, domain);
          vscode.window.showInformationMessage(`Domain '${domain}' removed.`);
          await this.updateData();
          this.onRefresh();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to remove domain: ${(err as Error).message}`);
        }
        break;
      }

      case 'verifyDomain': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        const domain = message.payload?.domain as string;
        if (!domain) return;

        try {
          const res = await this.client.domains.verifyDomain(projectConfig.projectId, domain);
          if (res.verified) {
            vscode.window.showInformationMessage(`Domain '${domain}' is successfully verified!`);
          } else {
            vscode.window.showWarningMessage(`Domain '${domain}' is pending DNS verification.`);
          }
          await this.updateData();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to verify domain: ${(err as Error).message}`);
        }
        break;
      }

      case 'runDiagnostics': {
        const projectConfig = this.getProjectConfig();
        if (!projectConfig) return;

        try {
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          const remoteProject = await this.client.projects.getProject(projectConfig.projectId);
          const envs = await this.client.environments.listEnvironmentVariables(projectConfig.projectId);
          const domains = await this.client.domains.listDomains(projectConfig.projectId);

          let latestLogs = '';
          try {
            const deps = await this.client.deployments.listDeployments(projectConfig.projectId, 1);
            if (deps.length > 0) {
              const events = await this.client.logs.getBuildEvents(deps[0].uid);
              latestLogs = events.map((e) => e.payload?.text || '').join('\n');
            }
          } catch {
            // Logs fetch error
          }

          const diagnostics = DiagnosticsEngine.runDiagnostics({
            logs: latestLogs,
            envs,
            targetEnv: 'production',
            domains
          });

          if (root) {
            const drifts = DriftDetector.detectDrift(root, remoteProject);
            for (const drift of drifts) {
              if (drift.hasDrift) {
                diagnostics.push({
                  id: `drift-${drift.property.toLowerCase().replace(/\\s+/g, '-')}`,
                  category: 'DRIFT',
                  severity: 'WARNING',
                  problem: `Configuration Drift: ${drift.property}`,
                  evidence: `Local: ${drift.localValue ?? 'unset'} | Cloud: ${drift.remoteValue ?? 'unset'}`,
                  likelyCause: 'Local project configuration differs from settings on Vercel.',
                  suggestedFix: drift.recommendation
                });
              }
            }
          }

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

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private escapeHtml(str: unknown): string {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getHtml(initialState?: Record<string, unknown> | null): string {
    const isLinked = !!(initialState && initialState.authenticated && initialState.projectConfig);
    const isUnauth = !!(initialState && initialState.authenticated === false);
    const initialConfig = initialState?.projectConfig as WorkspaceProjectConfig | undefined;
    const projName = initialConfig?.projectName || 'Project';
    const frameworkName = initialConfig?.framework || 'Custom';
    const projId = initialConfig?.projectId || '-';
    const rootPath = initialConfig?.rootPath || '-';
    const nonce = this.getNonce();
    const serializedInitial = JSON.stringify(initialState || null).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: ${this.panel.webview.cspSource}; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval';">
  <title>Vercel Control Center</title>
  <style>
    :root {
      --bg: #000000;
      --card-bg: #0a0a0a;
      --card-hover: #111111;
      --card-border: #1f1f1f;
      --card-border-hover: #333333;
      --text-main: #ededed;
      --text-muted: #888888;
      --text-dim: #555555;
      --vercel-blue: #0070f3;
      --vercel-blue-hover: #0056bd;
      --vercel-cyan: #50e3c2;
      --status-ready: #10b981;
      --status-building: #f5a623;
      --status-error: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist", Helvetica, Arial, sans-serif;
      --font-mono: "Geist Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
      background-size: 24px 24px;
      color: var(--text-main);
      font-family: var(--font);
      font-size: 13px;
      line-height: 1.5;
      letter-spacing: -0.015em;
      padding: 0;
      overflow-x: hidden;
      min-height: 100vh;
      position: relative;
      -webkit-font-smoothing: antialiased;
    }

    /* Ambient Hero Glow (Vercel Signature) */
    .ambient-glow {
      position: fixed;
      top: -240px;
      left: 50%;
      transform: translateX(-50%);
      width: 1000px;
      height: 480px;
      background: radial-gradient(ellipse at center, rgba(120, 119, 198, 0.15) 0%, rgba(0, 112, 243, 0.08) 35%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    /* Top Navigation Bar */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 24px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: saturate(180%) blur(16px);
      border-bottom: 1px solid var(--card-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: -0.02em;
    }

    .brand-triangle {
      display: inline-flex;
      align-items: center;
      color: #ffffff;
      transition: transform 0.15s ease;
    }
    .brand-triangle:hover {
      transform: scale(1.05);
    }

    .slash {
      color: #333333;
      font-weight: 300;
      font-size: 16px;
      user-select: none;
    }

    .scope-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-main);
      font-weight: 500;
    }

    /* Project Switcher Dropdown */
    .project-switcher {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .project-switcher-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: #ffffff;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.15s;
    }
    .project-switcher-btn:hover {
      background: #141414;
      border-color: #2c2c2c;
    }
    .dropdown-menu {
      display: none;
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: 270px;
      background: #0a0a0a;
      border: 1px solid #242424;
      border-radius: 8px;
      padding: 6px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85);
      z-index: 250;
    }
    .dropdown-menu.active {
      display: block;
      animation: fadeIn 0.15s ease-out;
    }
    .dropdown-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #777777;
      padding: 6px 10px 4px;
    }
    .dropdown-list {
      max-height: 220px;
      overflow-y: auto;
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 8px 10px;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: #ededed;
      font-family: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;
    }
    .dropdown-item:hover {
      background: #181818;
      color: #ffffff;
    }
    .dropdown-item.active {
      background: #141414;
      color: #ffffff;
      font-weight: 600;
    }
    .dropdown-divider {
      height: 1px;
      background: #1f1f1f;
      margin: 6px 0;
    }
    .dropdown-action {
      color: var(--vercel-blue);
      font-weight: 500;
    }
    .dropdown-action:hover {
      background: rgba(0, 112, 243, 0.1);
      color: #5eb1ff;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .team-select {
      background: #000000;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      font-family: var(--font);
      font-size: 12px;
      border-radius: 6px;
      padding: 6px 10px;
      outline: none;
      cursor: pointer;
      transition: all 0.15s;
    }
    .team-select:hover {
      border-color: var(--card-border-hover);
      background: #0c0c0c;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 32px;
      padding: 0 14px;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font);
      letter-spacing: -0.01em;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      text-decoration: none;
      user-select: none;
      white-space: nowrap;
    }

    .btn-primary {
      background: #ffffff;
      color: #000000;
      border-color: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    .btn-primary:hover {
      background: #eaeaea;
      border-color: #eaeaea;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #000000;
      border-color: var(--card-border);
      color: var(--text-main);
    }
    .btn-secondary:hover {
      background: #111111;
      border-color: var(--card-border-hover);
      color: #ffffff;
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.25);
      color: #f87171;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.16);
      border-color: rgba(239, 68, 68, 0.45);
    }

    .btn-sm {
      height: 26px;
      padding: 0 9px;
      font-size: 11px;
    }

    /* Main Container */
    .container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px 24px;
      position: relative;
      z-index: 1;
    }

    /* Project Hero Header */
    .project-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 18px;
    }
    .project-hero-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Navigation Tabs Bar */
    .tabs-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 28px;
    }
    .tab {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
      user-select: none;
      white-space: nowrap;
    }
    .tab:hover {
      color: #ffffff;
    }
    .tab.active {
      color: #ffffff;
      border-bottom-color: #ffffff;
      font-weight: 600;
    }

    /* State Screens */
    .view-section { display: none; }
    .view-section.active { display: block; animation: fadeIn 0.2s ease-in-out; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 22px;
      margin-bottom: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      transition: border-color 0.2s, background-color 0.2s;
    }
    .card:hover {
      border-color: var(--card-border-hover);
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #ffffff;
    }

    /* Auth Screen */
    .login-container {
      max-width: 420px;
      margin: 60px auto;
      text-align: center;
      background: #0a0a0a;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 40px 32px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    }
    .login-icon {
      margin-bottom: 24px;
    }
    .login-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.03em;
      margin-bottom: 8px;
      color: #ffffff;
    }
    .login-subtitle {
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .input-group {
      text-align: left;
      margin-bottom: 16px;
    }
    .input-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: block;
    }
    .input-field {
      width: 100%;
      height: 36px;
      background: #000000;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      color: #ffffff;
      font-family: var(--font-mono);
      font-size: 13px;
      padding: 0 12px;
      outline: none;
      transition: all 0.15s;
    }
    .input-field:focus {
      border-color: var(--vercel-blue);
      box-shadow: 0 0 0 1px var(--vercel-blue);
    }

    /* Project Linker View */
    .search-box {
      margin-bottom: 18px;
    }
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .project-card {
      background: #080808;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 18px;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .project-card:hover {
      border-color: var(--card-border-hover);
      background: #0e0e0e;
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
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 4px;
      background: #141414;
      border: 1px solid #282828;
      color: #d1d5db;
    }
    .badge-framework {
      background: rgba(0, 112, 243, 0.1);
      color: #5eb1ff;
      border: 1px solid rgba(0, 112, 243, 0.3);
    }

    /* Production Live Card */
    .prod-card {
      background: #0a0a0a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 22px;
      margin-bottom: 22px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
    }
    .prod-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, rgba(0, 112, 243, 0.8) 0%, rgba(80, 227, 194, 0.8) 50%, rgba(121, 40, 202, 0.8) 100%);
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
      font-weight: 500;
      font-size: 12px;
      color: var(--text-muted);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--status-ready);
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.7);
    }
    .pulse-dot.building {
      background: var(--status-building);
      box-shadow: 0 0 10px rgba(245, 166, 35, 0.7);
      animation: pulse 1.2s infinite ease-in-out;
    }
    .pulse-dot.error {
      background: var(--status-error);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.7);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }

    .prod-url {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.03em;
      color: #ffffff;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 14px;
      transition: color 0.15s;
    }
    .prod-url:hover {
      color: var(--vercel-blue);
    }

    .prod-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid #161616;
      padding-top: 14px;
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
      color: #666666;
      border-bottom: 1px solid var(--card-border);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid #141414;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
    }
    tr:hover td {
      background: #0a0a0a;
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
      letter-spacing: 0.02em;
    }
    .status-pill.ready { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
    .status-pill.building { background: rgba(245, 166, 35, 0.1); color: #fbbf24; border: 1px solid rgba(245, 166, 35, 0.25); }
    .status-pill.error { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); }
    .status-pill.queued { background: rgba(255, 255, 255, 0.06); color: #9ca3af; border: 1px solid rgba(255, 255, 255, 0.15); }

    /* Env variable secret mask */
    .secret-text {
      font-family: var(--font-mono);
      color: #555555;
      user-select: all;
    }

    /* Modal dialog */
    .modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(16px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal.active { display: flex; animation: fadeIn 0.15s ease-out; }
    .modal-box {
      background: #0a0a0a;
      border: 1px solid #282828;
      border-radius: 10px;
      padding: 28px;
      width: 90%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85);
    }

    /* Diagnostics Item */
    .diag-item {
      background: #080808;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      transition: border-color 0.15s;
    }
    .diag-item:hover {
      border-color: #383838;
    }
    .diag-item.critical { border-left: 3px solid #ef4444; }
    .diag-item.warning { border-left: 3px solid #f5a623; }
    .diag-item.info { border-left: 3px solid #0070f3; }
  </style>
</head>
<body>

  <!-- Ambient Hero Glow -->
  <div class="ambient-glow"></div>

  <!-- Top Header Bar -->
  <div class="topbar">
    <div class="breadcrumbs">
      <span class="brand-triangle" title="Vercel">
        <svg width="20" height="18" viewBox="0 0 76 65" fill="#ffffff">
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/>
        </svg>
      </span>
      <span class="slash">/</span>
      <span id="headerScope" class="scope-badge">Vercel</span>
      <span class="slash">/</span>
      
      <!-- Project Switcher in Breadcrumbs -->
      <div class="project-switcher" id="projectSwitcher">
        <button class="project-switcher-btn" id="projectSwitcherBtn" data-action="toggle-project-menu" title="Switch Project">
          <span id="headerProject">${isLinked ? projName : 'Control Center'}</span>
          <svg style="margin-left: 4px;" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="dropdown-menu" id="projectDropdownMenu">
          <div class="dropdown-header">Switch Project</div>
          <div class="dropdown-list" id="projectDropdownList">
            <!-- Dynamic items -->
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item dropdown-action" data-action="open-create-project">
            <span>+ Import New Project from Git</span>
          </button>
        </div>
      </div>
    </div>

    <div class="top-actions" id="topActions" style="${isLinked ? 'display: flex;' : 'display: none;'}">
      <select id="teamSelector" class="team-select">
        <option value="">Personal Account</option>
      </select>
      <button class="btn btn-secondary btn-sm" data-action="refresh">↻ Refresh</button>
      <button class="btn btn-secondary btn-sm" data-action="logout">Log Out</button>
    </div>
  </div>

  <div class="container">

    <!-- 0. LOADING VIEW -->
    <div id="viewLoading" class="view-section ${(!isLinked && !isUnauth) ? 'active' : ''}">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 45vh; gap: 14px;">
        <div class="pulse-dot building" style="width: 14px; height: 14px;"></div>
        <div style="color: var(--text-muted); font-size: 13px; font-weight: 500;">Connecting to Vercel...</div>
        <div id="loadingFallbackActions" style="margin-top: 14px; display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" data-action="ready">↻ Retry Connecting</button>
          <button class="btn btn-secondary btn-sm" data-action="force-dashboard">Show Dashboard →</button>
        </div>
      </div>
    </div>

    <!-- ERROR VIEW -->
    <div id="viewError" class="view-section">
      <div class="card" style="text-align: center; padding: 40px 20px; max-width: 520px; margin: 40px auto;">
        <div style="color: #ef4444; font-size: 28px; margin-bottom: 12px;">⚠</div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Unable to load Vercel project</h3>
        <p id="errorMessage" style="color: var(--text-muted); font-size: 13px; line-height: 1.5; margin-bottom: 24px;"></p>
        <div style="display: flex; justify-content: center; gap: 10px;">
          <button class="btn btn-secondary" data-action="refresh">↻ Retry</button>
          <button class="btn btn-secondary" data-action="logout">Log Out</button>
        </div>
      </div>
    </div>

    <!-- 1. NOT AUTHENTICATED VIEW -->
    <div id="viewLogin" class="view-section ${isUnauth ? 'active' : ''}">
      <div class="login-container">
        <div class="login-icon">
          <svg width="44" height="38" viewBox="0 0 76 65" fill="#ffffff">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/>
          </svg>
        </div>
        <h2 class="login-title">Connect your Vercel Account</h2>
        <p class="login-subtitle">Enter your Personal Access Token to manage deployments, environment variables, domains, and live observability.</p>

        <div class="input-group">
          <label class="input-label" for="tokenInput">Vercel Access Token</label>
          <input type="password" id="tokenInput" class="input-field" placeholder="Paste token here..." />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn btn-primary" style="flex: 1;" data-action="login">Connect Account</button>
          <button class="btn btn-secondary" data-action="get-token">Get Token ↗</button>
        </div>
      </div>
    </div>

    <!-- 2. NOT LINKED VIEW -->
    <div id="viewUnlinked" class="view-section">
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Workspace is not linked</h2>
        <p style="color: var(--text-muted); margin-bottom: 24px;">Link this local workspace to an existing Vercel project or import a new repository from Git.</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
          <button class="btn btn-primary" data-action="open-create-project">+ Import Project from Git</button>
          <button class="btn btn-secondary" data-action="open-terminal-link">⚡ Run "vercel link" in Terminal</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Your Vercel Projects</span>
          <span style="font-size: 12px; color: var(--text-muted);" id="projectCountLabel">0 projects</span>
        </div>
        <div class="search-box">
          <input type="text" id="projectSearchInput" class="input-field" placeholder="Search projects by name..." />
        </div>
        <div class="project-grid" id="projectGrid">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>

    <!-- 3. LINKED DASHBOARD VIEW -->
    <div id="viewDashboard" class="view-section ${isLinked ? 'active' : ''}">

      <!-- Project Hero Header -->
      <div class="project-hero">
        <div>
          <h1 class="project-hero-title">
            <span id="heroProjectName">${isLinked ? this.escapeHtml(projName) : '-'}</span>
            <span id="heroFrameworkBadge"><span class="badge badge-framework">${isLinked ? this.escapeHtml(frameworkName) : '-'}</span></span>
          </h1>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Project ID: <span id="heroProjectId" style="font-family: var(--font-mono);">${isLinked ? this.escapeHtml(projId) : '-'}</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" data-action="toggle-project-menu">Switch Project ▾</button>
          <button class="btn btn-secondary btn-sm" data-action="open-create-project">+ Add from Git</button>
          <button class="btn btn-secondary btn-sm" data-action="deploy-preview">Deploy Preview</button>
          <button class="btn btn-primary btn-sm" data-action="deploy-production">▲ Deploy Production</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-bar">
        <div class="tab active" data-tab="overview">Overview</div>
        <div class="tab" data-tab="deployments">Deployments</div>
        <div class="tab" data-tab="environment">Environment Variables</div>
        <div class="tab" data-tab="domains">Domains & DNS</div>
        <div class="tab" data-tab="diagnostics">AI Diagnostics</div>
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
              <button class="btn btn-secondary btn-sm" data-action="deploy-production">▲ Deploy to Prod</button>
              <button class="btn btn-secondary btn-sm" data-action="deploy-preview">Deploy Preview</button>
            </div>
          </div>
          <a href="#" id="prodLink" class="prod-url" target="_blank" data-action="open-prod-url">app-vercel.app ↗</a>
          <div class="prod-meta">
            <div class="meta-item"><span>Branch:</span> <b id="prodBranch">main</b></div>
            <div class="meta-item"><span>Commit:</span> <span id="prodCommit" style="font-family: var(--font-mono);">-</span></div>
            <div class="meta-item"><span>Created:</span> <span id="prodTime">-</span></div>
          </div>
        </div>

        <!-- Project Metadata Card -->
        <div class="card">
          <div class="card-title">
            <span>Project Details</span>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" data-action="toggle-project-menu">Switch Project</button>
              <button class="btn btn-danger btn-sm" data-action="unlink-project">Unlink Project</button>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <span class="input-label">Project Name</span>
              <div id="detailName" style="font-weight: 600; font-size: 14px;">${isLinked ? this.escapeHtml(projName) : '-'}</div>
            </div>
            <div>
              <span class="input-label">Framework</span>
              <div id="detailFramework"><span class="badge badge-framework">${isLinked ? this.escapeHtml(frameworkName) : '-'}</span></div>
            </div>
            <div>
              <span class="input-label">Project ID</span>
              <div id="detailId" style="font-family: var(--font-mono); color: var(--text-muted);">${isLinked ? this.escapeHtml(projId) : '-'}</div>
            </div>
            <div>
              <span class="input-label">Root Directory</span>
              <div id="detailRoot" style="font-family: var(--font-mono); color: var(--text-muted);">${isLinked ? this.escapeHtml(rootPath) : '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Deployments -->
      <div id="tabDeployments" class="tab-content" style="display: none;">
        <div class="card">
          <div class="card-title">
            <span>Recent Deployments</span>
            <button class="btn btn-primary btn-sm" data-action="deploy-preview">+ New Deployment</button>
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
              <button class="btn btn-secondary btn-sm" data-action="add-env-cli">⚡ Add via CLI (vercel env add)</button>
              <button class="btn btn-secondary btn-sm" data-action="pull-env">⬇ Pull to .env.local</button>
              <button class="btn btn-primary btn-sm" data-action="open-add-env">+ Add Variable</button>
            </div>
          </div>
          <div class="search-box">
            <input type="text" id="envSearchInput" class="input-field" placeholder="Filter variables by key..." />
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
            <span>Project Custom Domains</span>
            <button class="btn btn-primary btn-sm" data-action="open-add-domain">+ Add Custom Domain</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Apex</th>
                  <th>DNS Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="domainsTableBody">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <span>All Domains in Vercel Account / Team</span>
            <span style="font-size: 11px; color: var(--text-muted);" id="accountDomainCount">0 available</span>
          </div>
          <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 12px;">Available domains owned by this account/team that can be assigned to this project:</p>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="accountDomainsTableBody">
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
            <button class="btn btn-primary btn-sm" data-action="run-diagnostics">⚡ Run Deep Diagnosis</button>
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
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="envTargetProd" checked /> Production
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="envTargetPrev" checked /> Preview
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="envTargetDev" checked /> Development
          </label>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
        <button class="btn btn-secondary" data-action="close-env-modal">Cancel</button>
        <button class="btn btn-primary" data-action="submit-new-env">Save Variable</button>
      </div>
    </div>
  </div>

  <!-- Deploy Prompt Modal (When Env is Added) -->
  <div id="deployPromptModal" class="modal">
    <div class="modal-box">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0, 112, 243, 0.15); display: flex; align-items: center; justify-content: center; color: var(--vercel-blue);">
          ▲
        </div>
        <h3 style="font-size: 16px; font-weight: 600;">Deploy Environment Changes</h3>
      </div>
      <p style="color: var(--text-muted); font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
        Environment variable <b id="promptEnvKey" style="color: #fff; font-family: var(--font-mono);"></b> was added. To apply these values to your deployment runtime, a new deployment is required.
      </p>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-secondary" data-action="close-deploy-prompt">Later</button>
        <button class="btn btn-secondary" data-action="prompt-deploy-preview">Deploy Preview</button>
        <button class="btn btn-primary" data-action="prompt-deploy-prod">▲ Deploy Production</button>
      </div>
    </div>
  </div>

  <!-- Create Project from Git Modal -->
  <div id="createProjectModal" class="modal">
    <div class="modal-box">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">▲</span>
          <h3 style="font-size: 16px; font-weight: 600;">Import Git Repository</h3>
        </div>
        <button class="btn btn-secondary btn-sm" data-action="close-create-modal">✕</button>
      </div>
      <p style="color: var(--text-muted); font-size: 12px; line-height: 1.5; margin-bottom: 20px;">
        Deploy a new project to your Vercel account with minimal setup.
      </p>
      <div class="input-group">
        <label class="input-label" for="newProjRepo">Git Repository (GitHub / GitLab / Bitbucket)</label>
        <input type="text" id="newProjRepo" class="input-field" placeholder="e.g. vercel/next.js or https://github.com/owner/repo" />
      </div>
      <div class="input-group">
        <label class="input-label" for="newProjName">Project Name</label>
        <input type="text" id="newProjName" class="input-field" placeholder="my-awesome-project" />
      </div>
      <div class="input-group">
        <label class="input-label" for="newProjFramework">Framework Preset</label>
        <select id="newProjFramework" class="team-select" style="width: 100%; height: 36px;">
          <option value="">Other / Auto-detect</option>
          <option value="nextjs">Next.js</option>
          <option value="vite">Vite</option>
          <option value="create-react-app">Create React App</option>
          <option value="remix">Remix</option>
          <option value="vue">Vue</option>
          <option value="nuxtjs">Nuxt.js</option>
          <option value="svelte">Svelte</option>
          <option value="astro">Astro</option>
        </select>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px;">
        <button class="btn btn-secondary" data-action="close-create-modal">Cancel</button>
        <button class="btn btn-primary" data-action="submit-create-project">Import and Deploy</button>
      </div>
    </div>
  </div>

  <!-- Add Domain Modal -->
  <div id="addDomainModal" class="modal">
    <div class="modal-box">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Add Custom Domain</h3>
      <div class="input-group">
        <label class="input-label" for="newDomainInput">Domain Name</label>
        <input type="text" id="newDomainInput" class="input-field" placeholder="e.g. app.mydomain.com or mydomain.com" />
      </div>
      <div class="input-group">
        <label class="input-label" for="newDomainRedirect">Redirect Target (Optional)</label>
        <input type="text" id="newDomainRedirect" class="input-field" placeholder="Leave empty unless redirecting" />
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
        <button class="btn btn-secondary" data-action="close-domain-modal">Cancel</button>
        <button class="btn btn-primary" data-action="submit-new-domain">Add Domain</button>
      </div>
    </div>
  </div>

  <script id="initialStateData" type="application/json" nonce="${nonce}">${serializedInitial}</script>

  <script nonce="${nonce}">
    let vscode;
    try {
      vscode = acquireVsCodeApi();
    } catch (e) {
      vscode = window.vscode || {
        postMessage: function(msg) {
          console.log('postMessage fallback:', msg);
        }
      };
    }
    window.vscode = vscode;

    let currentState = null;
    let allAvailableProjects = [];
    let allEnvVariables = [];

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    window.escapeHtml = escapeHtml;

    function sendAction(type, payload) {
      if (vscode && vscode.postMessage) {
        vscode.postMessage({ type: type, payload: payload || {} });
      }
    }
    window.sendAction = sendAction;

    function openExternal(url) {
      if (!url) return;
      var clean = String(url).trim();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
      sendAction('openUrl', { url: clean });
    }
    window.openExternal = openExternal;

    function switchTab(tabName) {
      if (!tabName) return;
      var cleanTab = tabName.toLowerCase().replace(/^tab/, '');

      document.querySelectorAll('.tab').forEach(function(t) {
        var dt = t.getAttribute('data-tab');
        if (dt === cleanTab) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      document.querySelectorAll('.tab-content').forEach(function(c) {
        c.style.display = 'none';
      });

      var targetId = 'tab' + cleanTab.charAt(0).toUpperCase() + cleanTab.slice(1);
      var target = document.getElementById(targetId);
      if (target) {
        target.style.display = 'block';
      }
    }
    window.switchTab = switchTab;

    function handleProdClick() {
      var prodLink = document.getElementById('prodLink');
      var url = prodLink && (prodLink.dataset.url || prodLink.getAttribute('data-url') || prodLink.getAttribute('href'));
      if (url && url !== '#') {
        openExternal(url);
      }
    }
    window.handleProdClick = handleProdClick;

    function handleLogin() {
      const tokenInput = document.getElementById('tokenInput');
      const token = tokenInput ? tokenInput.value.trim() : '';
      if (!token) {
        if (tokenInput) {
          tokenInput.style.borderColor = '#ef4444';
          tokenInput.focus();
        }
        return;
      }
      sendAction('login', { token: token });
    }
    window.handleLogin = handleLogin;

    function handleTeamChange(teamId) {
      sendAction('switchTeam', { teamId: teamId });
    }
    window.handleTeamChange = handleTeamChange;

    function toggleProjectMenu() {
      const menu = document.getElementById('projectDropdownMenu');
      if (menu) {
        menu.classList.toggle('active');
      }
    }
    window.toggleProjectMenu = toggleProjectMenu;

    function closeProjectMenu() {
      const menu = document.getElementById('projectDropdownMenu');
      if (menu) {
        menu.classList.remove('active');
      }
    }
    window.closeProjectMenu = closeProjectMenu;

    function openCreateProjectModal() {
      closeProjectMenu();
      const r = document.getElementById('newProjRepo'); if (r) { r.value = ''; r.style.borderColor = ''; }
      const n = document.getElementById('newProjName'); if (n) { n.value = ''; n.style.borderColor = ''; }
      const f = document.getElementById('newProjFramework'); if (f) f.value = '';
      const m = document.getElementById('createProjectModal'); if (m) m.classList.add('active');
    }
    window.openCreateProjectModal = openCreateProjectModal;

    function closeCreateProjectModal() {
      const m = document.getElementById('createProjectModal'); if (m) m.classList.remove('active');
    }
    window.closeCreateProjectModal = closeCreateProjectModal;

    function handleRepoInput(val) {
      const nameInput = document.getElementById('newProjName');
      if (!val || !nameInput) return;
      const clean = val.trim().replace(/\.git$/, '');
      const parts = clean.split('/');
      const repoName = parts[parts.length - 1];
      if (repoName && (!nameInput.dataset.dirty || nameInput.dataset.dirty === 'false')) {
        nameInput.value = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      }
    }
    window.handleRepoInput = handleRepoInput;

    function submitCreateProject() {
      const repoInput = document.getElementById('newProjRepo');
      const nameInput = document.getElementById('newProjName');
      const frameworkInput = document.getElementById('newProjFramework');
      const gitUrl = repoInput ? repoInput.value.trim() : '';
      const name = nameInput ? nameInput.value.trim() : '';
      const framework = (frameworkInput && frameworkInput.value) || undefined;
      if (!name) {
        if (nameInput) {
          nameInput.style.borderColor = '#ef4444';
          nameInput.focus();
        }
        return;
      }
      sendAction('createProject', { name: name, gitUrl: gitUrl || undefined, framework: framework });
      closeCreateProjectModal();
    }
    window.submitCreateProject = submitCreateProject;

    function openAddEnvModal() {
      const k = document.getElementById('newEnvKey'); if (k) { k.value = ''; k.style.borderColor = ''; }
      const v = document.getElementById('newEnvValue'); if (v) { v.value = ''; v.style.borderColor = ''; }
      const m = document.getElementById('addEnvModal'); if (m) m.classList.add('active');
    }
    window.openAddEnvModal = openAddEnvModal;

    function closeAddEnvModal() {
      const m = document.getElementById('addEnvModal'); if (m) m.classList.remove('active');
    }
    window.closeAddEnvModal = closeAddEnvModal;

    function submitNewEnv() {
      const keyInput = document.getElementById('newEnvKey');
      const valInput = document.getElementById('newEnvValue');
      const key = keyInput ? keyInput.value.trim() : '';
      const value = valInput ? valInput.value.trim() : '';
      const targets = [];
      const prodCheck = document.getElementById('envTargetProd');
      const prevCheck = document.getElementById('envTargetPrev');
      const devCheck = document.getElementById('envTargetDev');
      if (prodCheck && prodCheck.checked) targets.push('production');
      if (prevCheck && prevCheck.checked) targets.push('preview');
      if (devCheck && devCheck.checked) targets.push('development');

      if (!key) {
        if (keyInput) { keyInput.style.borderColor = '#ef4444'; keyInput.focus(); }
        return;
      }
      if (!value) {
        if (valInput) { valInput.style.borderColor = '#ef4444'; valInput.focus(); }
        return;
      }

      sendAction('addEnv', { key: key, value: value, targets: targets });
      closeAddEnvModal();
      if (keyInput) keyInput.value = '';
      if (valInput) valInput.value = '';

      showDeployPrompt(key);
    }
    window.submitNewEnv = submitNewEnv;

    function showDeployPrompt(key) {
      const el = document.getElementById('promptEnvKey'); if (el) el.textContent = key;
      const m = document.getElementById('deployPromptModal'); if (m) m.classList.add('active');
    }
    window.showDeployPrompt = showDeployPrompt;

    function closeDeployPrompt() {
      const m = document.getElementById('deployPromptModal'); if (m) m.classList.remove('active');
    }
    window.closeDeployPrompt = closeDeployPrompt;

    function triggerDeployFromPrompt(target) {
      closeDeployPrompt();
      sendAction('deploy', { target: target });
    }
    window.triggerDeployFromPrompt = triggerDeployFromPrompt;

    function openAddDomainModal(prefill) {
      const di = document.getElementById('newDomainInput'); if (di) { di.value = prefill || ''; di.style.borderColor = ''; }
      const dr = document.getElementById('newDomainRedirect'); if (dr) { dr.value = ''; dr.style.borderColor = ''; }
      const m = document.getElementById('addDomainModal'); if (m) m.classList.add('active');
    }
    window.openAddDomainModal = openAddDomainModal;

    function closeAddDomainModal() {
      const m = document.getElementById('addDomainModal'); if (m) m.classList.remove('active');
    }
    window.closeAddDomainModal = closeAddDomainModal;

    function submitNewDomain() {
      const domInput = document.getElementById('newDomainInput');
      const redirInput = document.getElementById('newDomainRedirect');
      const domain = domInput ? domInput.value.trim() : '';
      const redirect = redirInput ? redirInput.value.trim() : '';
      if (!domain) {
        if (domInput) { domInput.style.borderColor = '#ef4444'; domInput.focus(); }
        return;
      }
      sendAction('addDomain', { domain: domain, redirect: redirect || undefined });
      closeAddDomainModal();
    }
    window.submitNewDomain = submitNewDomain;

    function renderError(msg) {
      const errView = document.getElementById('viewError');
      if (errView) {
        document.querySelectorAll('.view-section').forEach(function(v) { v.classList.remove('active'); });
        errView.classList.add('active');
      }
      const errEl = document.getElementById('errorMessage');
      if (errEl) errEl.textContent = msg || 'An unexpected error occurred while communicating with Vercel.';
    }
    window.renderError = renderError;

    function forceShowDashboard() {
      document.querySelectorAll('.view-section').forEach(function(v) { v.classList.remove('active'); });
      const dash = document.getElementById('viewDashboard');
      if (dash) dash.classList.add('active');
    }
    window.forceShowDashboard = forceShowDashboard;

    function renderState(data) {
      if (!data) return;
      try {
        currentState = data;

        const scopeEl = document.getElementById('headerScope');
        const projEl = document.getElementById('headerProject');
        const topActions = document.getElementById('topActions');

        if (data.authenticated) {
          if (topActions) topActions.style.display = 'flex';
          const teamSelector = document.getElementById('teamSelector');
          if (teamSelector) {
            teamSelector.innerHTML = '<option value="">Personal Account (' + escapeHtml((data.user && (data.user.username || data.user.email)) || 'User') + ')</option>';
            if (data.teams && data.teams.length) {
              data.teams.forEach(function(t) {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                if (data.activeTeamId === t.id) opt.selected = true;
                teamSelector.appendChild(opt);
              });
            }
          }

          const activeTeam = data.teams && data.teams.find(function(t) { return t.id === data.activeTeamId; });
          if (scopeEl) scopeEl.textContent = activeTeam ? activeTeam.name : ((data.user && (data.user.username || data.user.name)) || 'Personal');

          if (projEl) {
            if (data.projectConfig) {
              projEl.textContent = (data.currentProject && data.currentProject.name) || data.projectConfig.projectName || 'Project';
              projEl.style.color = '#ffffff';
            } else {
              projEl.textContent = 'Projects';
              projEl.style.color = '#888888';
            }
          }
        } else {
          if (topActions) topActions.style.display = 'none';
          if (scopeEl) scopeEl.textContent = 'Vercel';
          if (projEl) projEl.textContent = 'Control Center';
        }

        // Populate Project Switcher Dropdown
        const dropdownList = document.getElementById('projectDropdownList');
        if (dropdownList) {
          dropdownList.innerHTML = '';
          allAvailableProjects = data.availableProjects || [];
          const currentProjId = data.projectConfig && data.projectConfig.projectId;

          if (allAvailableProjects.length) {
            allAvailableProjects.forEach(function(p) {
              const item = document.createElement('button');
              const isCurrent = p.id === currentProjId;
              item.className = 'dropdown-item' + (isCurrent ? ' active' : '');
              item.setAttribute('data-action', 'link-project');
              item.setAttribute('data-project-id', p.id);
              item.innerHTML = '<span>' + escapeHtml(p.name) + '</span>' + (isCurrent ? '<span style="color: var(--vercel-cyan); font-size: 11px;">Active</span>' : '');
              dropdownList.appendChild(item);
            });
          } else {
            dropdownList.innerHTML = '<div style="padding: 8px 10px; color: var(--text-dim); font-size: 12px;">No projects found</div>';
          }
        }

        // Switch main view sections
        document.querySelectorAll('.view-section').forEach(function(v) { v.classList.remove('active'); });

        if (!data.authenticated) {
          const loginView = document.getElementById('viewLogin');
          if (loginView) loginView.classList.add('active');
          return;
        }

        if (!data.projectConfig) {
          const unlinkedView = document.getElementById('viewUnlinked');
          if (unlinkedView) unlinkedView.classList.add('active');
          renderProjectList(allAvailableProjects);
          return;
        }

        // Main Dashboard View
        const dashView = document.getElementById('viewDashboard');
        if (dashView) dashView.classList.add('active');
        renderDashboard(data);
      } catch (err) {
        console.error('renderState failed:', err);
      }
    }

    function renderProjectList(projects) {
      const grid = document.getElementById('projectGrid');
      const countLabel = document.getElementById('projectCountLabel');
      if (countLabel) countLabel.textContent = (projects ? projects.length : 0) + ' projects';
      if (!grid) return;
      grid.innerHTML = '';

      if (!projects || !projects.length) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No projects found under this account scope.</p>';
        return;
      }

      projects.forEach(function(p) {
        const div = document.createElement('div');
        div.className = 'project-card';
        div.setAttribute('data-action', 'link-project');
        div.setAttribute('data-project-id', p.id);
        div.innerHTML = '<div>' +
          '<div class="project-card-header">' +
            '<span class="project-name">' + escapeHtml(p.name) + '</span>' +
            '<span class="badge badge-framework">' + escapeHtml(p.framework || 'Other') + '</span>' +
          '</div>' +
          '<div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">ID: ' + escapeHtml(p.id) + '</div>' +
        '</div>' +
        '<div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">' +
          '<span style="font-size: 11px; color: var(--text-dim);">' + (p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '') + '</span>' +
          '<button class="btn btn-primary btn-sm" data-action="link-project" data-project-id="' + escapeHtml(p.id) + '">Link Project →</button>' +
        '</div>';
        grid.appendChild(div);
      });
    }

    function filterProjects(q) {
      const query = (q || '').toLowerCase();
      const filtered = allAvailableProjects.filter(function(p) {
        return p.name.toLowerCase().indexOf(query) !== -1 || (p.framework && p.framework.toLowerCase().indexOf(query) !== -1);
      });
      renderProjectList(filtered);
    }
    window.filterProjects = filterProjects;

    function renderDashboard(data) {
      try {
        const p = data.currentProject;
        const cfg = data.projectConfig;

        const projectName = (p && p.name) || (cfg && cfg.projectName) || '-';
        const framework = (p && p.framework) || (cfg && cfg.framework) || 'Custom';
        const projectId = (p && p.id) || (cfg && cfg.projectId) || '-';
        const rootPath = (cfg && cfg.rootPath) || '-';

        // Hero Elements
        const heroName = document.getElementById('heroProjectName');
        if (heroName) heroName.textContent = projectName;
        const heroBadge = document.getElementById('heroFrameworkBadge');
        if (heroBadge) heroBadge.innerHTML = '<span class="badge badge-framework">' + escapeHtml(framework) + '</span>';
        const heroId = document.getElementById('heroProjectId');
        if (heroId) heroId.textContent = projectId;

        // Project Details Card
        const detailName = document.getElementById('detailName');
        if (detailName) detailName.textContent = projectName;
        const detailFramework = document.getElementById('detailFramework');
        if (detailFramework) detailFramework.innerHTML = '<span class="badge badge-framework">' + escapeHtml(framework) + '</span>';
        const detailId = document.getElementById('detailId');
        if (detailId) detailId.textContent = projectId;
        const detailRoot = document.getElementById('detailRoot');
        if (detailRoot) detailRoot.textContent = rootPath;

        // Live Production Card
        const prod = (data.currentProject && data.currentProject.targets && data.currentProject.targets.production) || null;
        let latest = null;
        if (data.deployments && data.deployments.length) {
          latest = data.deployments.find(function(d) { return d.target === 'production'; }) || data.deployments[0];
        } else if (prod) {
          latest = {
            url: prod.url,
            state: prod.readyState || 'READY',
            meta: prod.meta,
            created: null
          };
        }

        const prodDot = document.getElementById('prodDot');
        const prodStateText = document.getElementById('prodStateText');
        const prodLink = document.getElementById('prodLink');

        if (latest) {
          const st = latest.state || 'READY';
          if (prodDot) prodDot.className = 'pulse-dot ' + (st === 'BUILDING' || st === 'QUEUED' ? 'building' : st === 'ERROR' ? 'error' : '');
          if (prodStateText) prodStateText.textContent = 'Production (' + st + ')';
          if (prodLink) {
            prodLink.textContent = (latest.url || 'app-vercel.app') + ' ↗';
            prodLink.dataset.url = latest.url || '';
          }
          const branchEl = document.getElementById('prodBranch');
          if (branchEl) branchEl.textContent = (latest.meta && (latest.meta.githubCommitRef || latest.meta.gitlabCommitRef || latest.meta.branch)) || 'main';
          const commitEl = document.getElementById('prodCommit');
          if (commitEl) {
            const sha = latest.meta && latest.meta.githubCommitSha;
            const msg = latest.meta && (latest.meta.githubCommitMessage || latest.meta.commitMessage);
            commitEl.textContent = sha ? sha.substring(0, 7) : (msg ? msg.substring(0, 30) : '-');
          }
          const timeEl = document.getElementById('prodTime');
          if (timeEl) {
            const timeVal = latest.created || latest.createdAt;
            timeEl.textContent = timeVal ? new Date(timeVal).toLocaleTimeString() : '-';
          }
        } else {
          if (prodDot) prodDot.className = 'pulse-dot';
          if (prodStateText) prodStateText.textContent = 'No deployments yet';
          if (prodLink) {
            prodLink.textContent = '-';
            prodLink.dataset.url = '';
          }
          const branchEl = document.getElementById('prodBranch');
          if (branchEl) branchEl.textContent = '-';
          const commitEl = document.getElementById('prodCommit');
          if (commitEl) commitEl.textContent = '-';
          const timeEl = document.getElementById('prodTime');
          if (timeEl) timeEl.textContent = '-';
        }

        // Render Deployments Table
        const depBody = document.getElementById('deploymentsTableBody');
        if (depBody) {
          depBody.innerHTML = '';
          if (data.deployments && data.deployments.length) {
            data.deployments.forEach(function(d) {
              const tr = document.createElement('tr');
              const stateClass = d.state ? d.state.toLowerCase() : 'ready';
              const commitMsg = (d.meta && (d.meta.githubCommitMessage || d.meta.commitMessage)) || '-';
              const branch = (d.meta && (d.meta.githubCommitRef || d.meta.branch)) || 'main';
              const timeVal = d.created || d.createdAt;
              const dateStr = timeVal ? (new Date(timeVal).toLocaleDateString() + ' ' + new Date(timeVal).toLocaleTimeString()) : '-';
              tr.innerHTML = '<td><span class="status-pill ' + stateClass + '">' + escapeHtml(d.state || 'READY') + '</span></td>' +
                '<td><a href="#" style="color: #fff; text-decoration: none;" data-action="open-url" data-url="' + escapeHtml(d.url || '') + '">' + escapeHtml(d.url || '-') + ' ↗</a></td>' +
                '<td>' + escapeHtml(commitMsg) + '</td>' +
                '<td><span class="badge">' + escapeHtml(branch) + '</span></td>' +
                '<td>' + dateStr + '</td>' +
                '<td><button class="btn btn-secondary btn-sm" data-action="view-logs" data-deployment-id="' + escapeHtml(d.uid || d.id || '') + '">Logs</button></td>';
              depBody.appendChild(tr);
            });
          } else {
            depBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No deployments found</td></tr>';
          }
        }

        // Render Env Vars
        allEnvVariables = data.envVariables || [];
        renderEnvVars(allEnvVariables);

        // Render Project Domains
        const domBody = document.getElementById('domainsTableBody');
        if (domBody) {
          domBody.innerHTML = '';
          if (data.domains && data.domains.length) {
            data.domains.forEach(function(dom) {
              const tr = document.createElement('tr');
              tr.innerHTML = '<td><b style="color: #fff;">' + escapeHtml(dom.name) + '</b></td>' +
                '<td>' + (dom.apexName ? escapeHtml(dom.apexName) : '-') + '</td>' +
                '<td><span class="status-pill ' + (dom.verified ? 'ready' : 'error') + '">' + (dom.verified ? 'VERIFIED' : 'PENDING') + '</span></td>' +
                '<td><div style="display: flex; gap: 6px;">' +
                  '<button class="btn btn-secondary btn-sm" data-action="verify-domain" data-domain="' + escapeHtml(dom.name) + '">Verify</button>' +
                  '<button class="btn btn-secondary btn-sm" data-action="visit-domain" data-domain="' + escapeHtml(dom.name) + '">Visit ↗</button>' +
                  '<button class="btn btn-danger btn-sm" data-action="delete-domain" data-domain="' + escapeHtml(dom.name) + '">Remove</button>' +
                '</div></td>';
              domBody.appendChild(tr);
            });
          } else {
            domBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">No custom domains configured for this project</td></tr>';
          }
        }

        // Render Account / Available Domains
        const accDomBody = document.getElementById('accountDomainsTableBody');
        const countLabel = document.getElementById('accountDomainCount');
        if (accDomBody) {
          accDomBody.innerHTML = '';
          const accountDomains = data.accountDomains || [];
          if (countLabel) countLabel.textContent = accountDomains.length + ' available';

          const projectDomainNames = new Set((data.domains || []).map(function(d) { return d.name; }));

          if (accountDomains.length) {
            accountDomains.forEach(function(ad) {
              const isAttached = projectDomainNames.has(ad.name);
              const tr = document.createElement('tr');
              tr.innerHTML = '<td><b style="color: #fff;">' + escapeHtml(ad.name) + '</b></td>' +
                '<td><span class="badge ' + (isAttached ? 'badge-framework' : '') + '">' + (isAttached ? 'Linked to this project' : 'Unassigned to this project') + '</span></td>' +
                '<td>' + (isAttached
                  ? '<span style="color: var(--text-dim); font-size: 11px;">Already Linked</span>'
                  : '<button class="btn btn-primary btn-sm" data-action="assign-domain" data-domain="' + escapeHtml(ad.name) + '">+ Assign to Project</button>') +
                '</td>';
              accDomBody.appendChild(tr);
            });
          } else {
            accDomBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">No other domains found in this account scope</td></tr>';
          }
        }
      } catch (err) {
        console.error('renderDashboard error:', err);
      }
    }

    function renderEnvVars(vars) {
      const envBody = document.getElementById('envTableBody');
      if (!envBody) return;
      envBody.innerHTML = '';
      if (vars && vars.length) {
        vars.forEach(function(v) {
          const tr = document.createElement('tr');
          const targets = Array.isArray(v.target) ? v.target.join(', ') : (v.target || 'all');
          tr.innerHTML = '<td><b style="color: #fff; font-family: var(--font-mono);">' + escapeHtml(v.key) + '</b></td>' +
            '<td><span class="secret-text">••••••••••••</span></td>' +
            '<td><span class="badge">' + escapeHtml(targets) + '</span></td>' +
            '<td>' + (v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : '-') + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-action="delete-env" data-env-id="' + escapeHtml(v.id) + '" data-env-key="' + escapeHtml(v.key) + '">Delete</button></td>';
          envBody.appendChild(tr);
        });
      } else {
        envBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No environment variables found</td></tr>';
      }
    }

    function filterEnvVars(q) {
      const query = (q || '').toLowerCase();
      const filtered = allEnvVariables.filter(function(v) {
        return v.key.toLowerCase().indexOf(query) !== -1;
      });
      renderEnvVars(filtered);
    }
    window.filterEnvVars = filterEnvVars;

    function renderDiagnostics(items) {
      const container = document.getElementById('diagnosticsList');
      if (!container) return;
      container.innerHTML = '';
      if (!items || !items.length) {
        container.innerHTML = '<p style="color: var(--status-ready); font-weight: 600;">✓ All checks passed! No configuration drift or build errors detected.</p>';
        return;
      }

      items.forEach(function(d) {
        const div = document.createElement('div');
        const sev = (d.severity || 'info').toLowerCase();
        div.className = 'diag-item ' + sev;
        div.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
          '<b style="color: #fff;">' + escapeHtml(d.problem) + '</b>' +
          '<span class="status-pill ' + sev + '">' + escapeHtml(d.severity) + '</span>' +
        '</div>' +
        '<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">' + escapeHtml(d.evidence || '') + '</div>' +
        '<div style="background: rgba(255, 255, 255, 0.04); padding: 8px 12px; border-radius: 6px; font-size: 12px;">' +
          '<b style="color: var(--vercel-cyan);">Suggested Fix:</b> ' + escapeHtml(d.suggestedFix) +
        '</div>';
        container.appendChild(div);
      });
    }

    function handleAction(action, el) {
      if (!action) return;

      switch (action) {
        case 'deploy-production':
          sendAction('deploy', { target: 'production' });
          break;

        case 'deploy-preview':
          sendAction('deploy', { target: 'preview' });
          break;

        case 'toggle-project-menu':
          toggleProjectMenu();
          break;

        case 'open-create-project':
          openCreateProjectModal();
          break;

        case 'close-create-modal':
          closeCreateProjectModal();
          break;

        case 'submit-create-project':
          submitCreateProject();
          break;

        case 'unlink-project':
          sendAction('unlinkProject');
          break;

        case 'open-prod-url':
          handleProdClick();
          break;

        case 'refresh':
          sendAction('refresh');
          break;

        case 'logout':
          sendAction('logout');
          break;

        case 'login':
          handleLogin();
          break;

        case 'get-token':
          openExternal('https://vercel.com/account/tokens');
          break;

        case 'open-terminal-link':
          sendAction('openTerminalLink');
          break;

        case 'ready':
          sendAction('ready');
          break;

        case 'force-dashboard':
          forceShowDashboard();
          break;

        case 'add-env-cli':
          sendAction('addEnvCli');
          break;

        case 'pull-env':
          sendAction('pullEnv');
          break;

        case 'open-add-env':
          openAddEnvModal();
          break;

        case 'close-env-modal':
          closeAddEnvModal();
          break;

        case 'submit-new-env':
          submitNewEnv();
          break;

        case 'close-deploy-prompt':
          closeDeployPrompt();
          break;

        case 'prompt-deploy-preview':
          triggerDeployFromPrompt('preview');
          break;

        case 'prompt-deploy-prod':
          triggerDeployFromPrompt('production');
          break;

        case 'open-add-domain':
          openAddDomainModal();
          break;

        case 'close-domain-modal':
          closeAddDomainModal();
          break;

        case 'submit-new-domain':
          submitNewDomain();
          break;

        case 'run-diagnostics':
          sendAction('runDiagnostics');
          break;

        case 'view-logs': {
          const depId = el.getAttribute('data-deployment-id');
          if (depId) sendAction('viewLogs', { deploymentId: depId });
          break;
        }

        case 'delete-env': {
          const id = el.getAttribute('data-env-id');
          const key = el.getAttribute('data-env-key');
          if (id) sendAction('deleteEnv', { id: id, key: key });
          break;
        }

        case 'verify-domain': {
          const domain = el.getAttribute('data-domain');
          if (domain) sendAction('verifyDomain', { domain: domain });
          break;
        }

        case 'visit-domain': {
          const domain = el.getAttribute('data-domain');
          if (domain) openExternal(domain);
          break;
        }

        case 'delete-domain': {
          const domain = el.getAttribute('data-domain');
          if (domain) sendAction('deleteDomain', { domain: domain });
          break;
        }

        case 'assign-domain': {
          const domain = el.getAttribute('data-domain');
          openAddDomainModal(domain);
          break;
        }

        case 'open-url': {
          const url = el.getAttribute('data-url');
          if (url) openExternal(url);
          break;
        }

        case 'link-project': {
          const pid = el.getAttribute('data-project-id');
          const p = allAvailableProjects.find(function(item) { return item.id === pid; });
          if (p) {
            closeProjectMenu();
            sendAction('linkProject', { project: p });
          }
          break;
        }
      }
    }

    // Capture-phase Universal Click Listener
    document.addEventListener('click', function(e) {
      // 1. Check for tab button click
      const tabEl = e.target.closest('.tab[data-tab]');
      if (tabEl) {
        e.preventDefault();
        e.stopPropagation();
        switchTab(tabEl.getAttribute('data-tab'));
        return;
      }

      // 2. Check for action element click
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        e.preventDefault();
        e.stopPropagation();
        handleAction(actionEl.getAttribute('data-action'), actionEl);
        return;
      }

      // 3. Dropdown outside click dismiss
      if (!e.target.closest('#projectSwitcher')) {
        closeProjectMenu();
      }
    }, true);

    // Form inputs and filters
    document.addEventListener('input', function(e) {
      if (!e.target) return;
      if (e.target.id === 'envSearchInput') {
        filterEnvVars(e.target.value);
      } else if (e.target.id === 'projectSearchInput') {
        filterProjects(e.target.value);
      } else if (e.target.id === 'newProjRepo') {
        handleRepoInput(e.target.value);
      }
    });

    document.addEventListener('change', function(e) {
      if (e.target && e.target.id === 'teamSelector') {
        handleTeamChange(e.target.value);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        if (e.target && e.target.id === 'tokenInput') {
          handleLogin();
        } else if (e.target && (e.target.id === 'newEnvKey' || e.target.id === 'newEnvValue')) {
          submitNewEnv();
        } else if (e.target && (e.target.id === 'newDomainInput' || e.target.id === 'newDomainRedirect')) {
          submitNewDomain();
        }
      }
    });

    // Message listener for host extension communications
    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'state') {
        renderState(msg.data);
      } else if (msg.type === 'diagnosticsResult') {
        renderDiagnostics(msg.data);
      } else if (msg.type === 'error') {
        renderError(msg.message);
      }
    });

    window.onerror = function(message, source, lineno, colno, error) {
      console.error('Webview Script Error:', message, lineno, error);
    };

    // Immediate Boot sequence
    try {
      const rawInitial = document.getElementById('initialStateData');
      if (rawInitial && rawInitial.textContent) {
        const parsed = JSON.parse(rawInitial.textContent);
        if (parsed) {
          renderState(parsed);
        }
      }
    } catch (err) {
      console.warn('Initial state hydration note:', err);
    }

    // Handshake with extension host
    sendAction('ready');

    // Interval to ensure data sync
    const readyTimer = setInterval(function() {
      if (currentState && currentState.deployments && currentState.deployments.length) {
        clearInterval(readyTimer);
      } else {
        sendAction('ready');
      }
    }, 1200);

    setTimeout(function() {
      clearInterval(readyTimer);
    }, 15000);
  </script>
</body>
</html>`;
  }
}
