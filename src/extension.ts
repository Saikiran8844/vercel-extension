import * as vscode from 'vscode';
import { TokenManager } from './auth/tokenManager';
import { VercelClient } from './api/vercelClient';
import { ProjectDetector } from './project/detector';
import { WorkspaceProjectConfig } from './types/extension';
import { StatusBarManager } from './views/statusBar';
import { LogViewer } from './views/logViewer';
import { DashboardPanel } from './views/dashboardPanel';
import { CurrentProjectTreeDataProvider } from './providers/currentProjectTree';
import { DeploymentsTreeDataProvider } from './providers/deploymentsTree';
import { EnvironmentTreeDataProvider } from './providers/environmentTree';
import { DomainsTreeDataProvider } from './providers/domainsTree';
import { ProjectsTreeDataProvider } from './providers/projectsTree';
import { TeamsTreeDataProvider } from './providers/teamsTree';
import { PlatformServicesTreeDataProvider } from './providers/platformServicesTree';
import { registerAuthCommands } from './commands/authCommands';
import { registerDeploymentCommands } from './commands/deploymentCommands';
import { registerEnvCommands } from './commands/envCommands';
import { registerDomainCommands } from './commands/domainCommands';
import { registerDiagnosticCommands } from './commands/diagnosticCommands';

let statusBar: StatusBarManager | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const tokenManager = new TokenManager(context.secrets, context.globalState);

  // Client with dynamic token and team scope
  const client = new VercelClient(
    () => tokenManager.getAccessToken(),
    () => tokenManager.getActiveTeamId()
  );

  let projectConfig: WorkspaceProjectConfig | null = null;

  function refreshProjectDetection(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      projectConfig = ProjectDetector.detectProject(root);
    } else {
      projectConfig = null;
    }
  }

  refreshProjectDetection();

  // Status Bar & Log Viewer
  statusBar = new StatusBarManager();
  const logViewer = new LogViewer();
  context.subscriptions.push(logViewer);

  // Tree Data Providers
  const currentProjectProvider = new CurrentProjectTreeDataProvider(client, () => projectConfig);
  const deploymentsProvider = new DeploymentsTreeDataProvider(client, () => projectConfig);
  const environmentProvider = new EnvironmentTreeDataProvider(client, () => projectConfig);
  const domainsProvider = new DomainsTreeDataProvider(client, () => projectConfig);
  const projectsProvider = new ProjectsTreeDataProvider(client);
  const teamsProvider = new TeamsTreeDataProvider(client, () => tokenManager.getActiveTeamId());
  const platformServicesProvider = new PlatformServicesTreeDataProvider(client, () => projectConfig?.projectId);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vercel.currentProject', currentProjectProvider),
    vscode.window.registerTreeDataProvider('vercel.deployments', deploymentsProvider),
    vscode.window.registerTreeDataProvider('vercel.environments', environmentProvider),
    vscode.window.registerTreeDataProvider('vercel.domains', domainsProvider),
    vscode.window.registerTreeDataProvider('vercel.projects', projectsProvider),
    vscode.window.registerTreeDataProvider('vercel.teams', teamsProvider),
    vscode.window.registerTreeDataProvider('vercel.platformServices', platformServicesProvider)
  );

  function refreshAllViews(): void {
    client.invalidateAllCache();
    refreshProjectDetection();
    currentProjectProvider.refresh();
    deploymentsProvider.refresh();
    environmentProvider.refresh();
    domainsProvider.refresh();
    projectsProvider.refresh();
    teamsProvider.refresh();
    platformServicesProvider.refresh();
    updateStatusBar();
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.updateData();
    }
  }

  // Periodic polling function
  async function updateStatusBar(): Promise<void> {
    const token = await tokenManager.getAccessToken();
    if (!token) {
      statusBar?.setState('NOT_LOGGED_IN');
      return;
    }

    if (!projectConfig) {
      statusBar?.setState('NOT_LINKED');
      return;
    }

    try {
      const deployments = await client.deployments.listDeployments(projectConfig.projectId, 1);
      const latest = deployments[0];

      if (!latest) {
        statusBar?.setState('READY');
        return;
      }

      if (latest.state === 'BUILDING' || latest.state === 'QUEUED') {
        statusBar?.setState('BUILDING', latest.state, latest);
        statusBar?.startPolling(updateStatusBar, true);
      } else if (latest.state === 'ERROR' || latest.state === 'CANCELED') {
        statusBar?.setState('ERROR', latest.state, latest);
        statusBar?.startPolling(updateStatusBar, false);
      } else {
        statusBar?.setState('READY', undefined, latest);
        statusBar?.startPolling(updateStatusBar, false);
      }
    } catch {
      statusBar?.setState('OFFLINE');
    }
  }

  // Register all commands
  registerAuthCommands(context, tokenManager, client, refreshAllViews);
  registerDeploymentCommands(context, client, tokenManager, () => projectConfig, logViewer, refreshAllViews);
  registerEnvCommands(context, client, tokenManager, () => projectConfig, refreshAllViews);
  registerDomainCommands(context, client, () => projectConfig, refreshAllViews);
  registerDiagnosticCommands(context, client, tokenManager, () => projectConfig, logViewer, refreshAllViews);

  // General Refresh Command
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.refresh', () => {
      refreshAllViews();
    }),
    vscode.commands.registerCommand('vercel.openDashboardPanel', () => {
      DashboardPanel.createOrShow(
        context.extensionUri,
        client,
        tokenManager,
        () => projectConfig,
        refreshAllViews
      );
    })
  );

  // FileSystemWatcher for .vercel/project.json and vercel.json
  const watcher = vscode.workspace.createFileSystemWatcher('**/{.vercel/project.json,vercel.json}');
  watcher.onDidChange(() => refreshAllViews());
  watcher.onDidCreate(() => refreshAllViews());
  watcher.onDidDelete(() => refreshAllViews());
  context.subscriptions.push(watcher);

  // Initial update
  await updateStatusBar();
}

export function deactivate(): void {
  if (statusBar) {
    statusBar.dispose();
    statusBar = null;
  }
}
