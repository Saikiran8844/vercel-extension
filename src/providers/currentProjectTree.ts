import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { WorkspaceProjectConfig, VercelTreeItem } from '../types/extension';
import { VercelProject, VercelDeployment } from '../types/vercel';

export class CurrentProjectTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VercelTreeItem | undefined | null | void> =
    new vscode.EventEmitter<VercelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<VercelTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private currentProject: VercelProject | null = null;
  private latestDeployment: VercelDeployment | null = null;

  constructor(
    private client: VercelClient,
    private getProjectConfig: () => WorkspaceProjectConfig | null
  ) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: VercelTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: VercelTreeItem): Promise<VercelTreeItem[]> {
    if (element) {
      return [];
    }

    const config = this.getProjectConfig();
    if (!config) {
      const linkItem: VercelTreeItem = new vscode.TreeItem(
        'Workspace not linked to Vercel',
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      linkItem.contextValue = 'action';
      linkItem.iconPath = new vscode.ThemeIcon('cloud-upload');
      linkItem.command = {
        command: 'vercel.linkProject',
        title: 'Link Project'
      };

      const dashItem: VercelTreeItem = new vscode.TreeItem(
        'Open Control Center Dashboard',
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      dashItem.contextValue = 'action';
      dashItem.iconPath = new vscode.ThemeIcon('dashboard');
      dashItem.command = {
        command: 'vercel.openDashboardPanel',
        title: 'Open Control Center Dashboard'
      };

      return [dashItem, linkItem];
    }

    try {
      this.currentProject = await this.client.projects.getProject(config.projectId);
      const deployments = await this.client.deployments.listDeployments(config.projectId, 1);
      this.latestDeployment = deployments[0] || null;
    } catch {
      // In offline / error mode, display offline item
      const item: VercelTreeItem = new vscode.TreeItem(
        `Project: ${config.projectName || config.projectId} (Offline)`,
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      item.contextValue = 'info';
      item.iconPath = new vscode.ThemeIcon('cloud-offline');
      return [item];
    }

    const items: VercelTreeItem[] = [];

    // Open Interactive Dashboard
    const dashItem: VercelTreeItem = new vscode.TreeItem(
      'Open Control Center Dashboard',
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    dashItem.contextValue = 'action';
    dashItem.iconPath = new vscode.ThemeIcon('dashboard');
    dashItem.command = {
      command: 'vercel.openDashboardPanel',
      title: 'Open Control Center Dashboard'
    };
    items.push(dashItem);

    // Project Name & Dashboard
    const nameItem: VercelTreeItem = new vscode.TreeItem(
      this.currentProject.name,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    nameItem.contextValue = 'project';
    nameItem.iconPath = new vscode.ThemeIcon('project');
    nameItem.description = this.currentProject.framework ? `(${this.currentProject.framework})` : '';
    nameItem.command = {
      command: 'vercel.openProject',
      title: 'Open in Dashboard'
    };
    items.push(nameItem);

    // Production Domain
    const prodTarget = this.currentProject.targets?.production;
    const prodDomain = prodTarget?.url || this.latestDeployment?.url || 'No active deployment';
    const domainItem: VercelTreeItem = new vscode.TreeItem(
      `Domain: ${prodDomain}`,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    domainItem.contextValue = 'info';
    domainItem.iconPath = new vscode.ThemeIcon('globe');
    if (prodDomain !== 'No active deployment') {
      domainItem.command = {
        command: 'vscode.open',
        title: 'Open Domain',
        arguments: [vscode.Uri.parse(`https://${prodDomain}`)]
      };
    }
    items.push(domainItem);

    // Latest Deployment & Status
    if (this.latestDeployment) {
      const state = this.latestDeployment.state;
      let icon = 'pass';
      if (state === 'BUILDING' || state === 'QUEUED') icon = 'sync~spin';
      if (state === 'ERROR' || state === 'CANCELED') icon = 'error';

      const depItem: VercelTreeItem = new vscode.TreeItem(
        `Latest: ${state} (${this.latestDeployment.url})`,
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      depItem.contextValue = 'deployment';
      depItem.iconPath = new vscode.ThemeIcon(icon);
      depItem.description = new Date(this.latestDeployment.created).toLocaleTimeString();
      depItem.data = this.latestDeployment;
      depItem.command = {
        command: 'vercel.inspectDeployment',
        title: 'Inspect Deployment',
        arguments: [this.latestDeployment]
      };
      items.push(depItem);
    }

    // Git Branch
    if (this.currentProject.link?.productionBranch) {
      const gitItem: VercelTreeItem = new vscode.TreeItem(
        `Production Branch: ${this.currentProject.link.productionBranch}`,
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      gitItem.contextValue = 'info';
      gitItem.iconPath = new vscode.ThemeIcon('git-branch');
      items.push(gitItem);
    }

    // Fluid Compute & CPU Info
    const computeItem: VercelTreeItem = new vscode.TreeItem(
      'Compute: Fluid Compute (Active)',
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    computeItem.contextValue = 'info';
    computeItem.iconPath = new vscode.ThemeIcon('pulse');
    computeItem.tooltip = 'Optimized function concurrency and execution model';
    items.push(computeItem);

    return items;
  }
}
