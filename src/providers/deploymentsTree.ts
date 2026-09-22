import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { WorkspaceProjectConfig, VercelTreeItem } from '../types/extension';
import { VercelDeployment } from '../types/vercel';

export class DeploymentsTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VercelTreeItem | undefined | null | void> =
    new vscode.EventEmitter<VercelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<VercelTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

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
    const config = this.getProjectConfig();
    if (!config) {
      return [];
    }

    if (!element) {
      // Root level: Categories (Production, Preview, All)
      const prodCategory: VercelTreeItem = new vscode.TreeItem(
        'Production',
        vscode.TreeItemCollapsibleState.Expanded
      ) as VercelTreeItem;
      prodCategory.contextValue = 'category';
      prodCategory.iconPath = new vscode.ThemeIcon('server-environment');
      prodCategory.data = { category: 'production' };

      const prevCategory: VercelTreeItem = new vscode.TreeItem(
        'Preview',
        vscode.TreeItemCollapsibleState.Expanded
      ) as VercelTreeItem;
      prevCategory.contextValue = 'category';
      prevCategory.iconPath = new vscode.ThemeIcon('git-pull-request');
      prevCategory.data = { category: 'preview' };

      return [prodCategory, prevCategory];
    }

    if (element.contextValue === 'category') {
      const category = (element.data as { category: string }).category;
      try {
        const deployments = await this.client.deployments.listDeployments(config.projectId, 20);
        const filtered = deployments.filter((d) => {
          if (category === 'production') return d.target === 'production';
          return d.target !== 'production';
        });

        if (filtered.length === 0) {
          const emptyItem: VercelTreeItem = new vscode.TreeItem(
            `No ${category} deployments`,
            vscode.TreeItemCollapsibleState.None
          ) as VercelTreeItem;
          emptyItem.contextValue = 'info';
          return [emptyItem];
        }

        return filtered.map((d) => this.createDeploymentItem(d));
      } catch {
        const errItem: VercelTreeItem = new vscode.TreeItem(
          'Failed to load deployments',
          vscode.TreeItemCollapsibleState.None
        ) as VercelTreeItem;
        errItem.contextValue = 'info';
        return [errItem];
      }
    }

    return [];
  }

  private createDeploymentItem(dep: VercelDeployment): VercelTreeItem {
    let icon = 'pass';
    if (dep.state === 'BUILDING' || dep.state === 'QUEUED') icon = 'sync~spin';
    if (dep.state === 'ERROR' || dep.state === 'CANCELED') icon = 'error';

    const commit = dep.meta?.githubCommitSha?.substring(0, 7) || '';
    const branch = dep.meta?.branch || dep.meta?.githubCommitRef || '';
    const descParts: string[] = [];
    if (branch) descParts.push(branch);
    if (commit) descParts.push(`(${commit})`);

    const label = dep.url;
    const item: VercelTreeItem = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;

    item.contextValue = 'deployment';
    item.iconPath = new vscode.ThemeIcon(icon);
    item.description = descParts.join(' ');
    item.tooltip = `Status: ${dep.state}\nCreated: ${new Date(dep.created).toLocaleString()}\nTarget: ${dep.target || 'preview'}`;
    item.data = dep;
    item.command = {
      command: 'vercel.inspectDeployment',
      title: 'Inspect Deployment',
      arguments: [dep]
    };

    return item;
  }
}
