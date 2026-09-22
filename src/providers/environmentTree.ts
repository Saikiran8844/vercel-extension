import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { WorkspaceProjectConfig, VercelTreeItem } from '../types/extension';
import { VercelEnvVariable } from '../types/vercel';

export class EnvironmentTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
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
      const prodCategory: VercelTreeItem = new vscode.TreeItem(
        'Production Variables',
        vscode.TreeItemCollapsibleState.Expanded
      ) as VercelTreeItem;
      prodCategory.contextValue = 'category';
      prodCategory.iconPath = new vscode.ThemeIcon('lock');
      prodCategory.data = { env: 'production' };

      const prevCategory: VercelTreeItem = new vscode.TreeItem(
        'Preview Variables',
        vscode.TreeItemCollapsibleState.Collapsed
      ) as VercelTreeItem;
      prevCategory.contextValue = 'category';
      prevCategory.iconPath = new vscode.ThemeIcon('key');
      prevCategory.data = { env: 'preview' };

      const devCategory: VercelTreeItem = new vscode.TreeItem(
        'Development Variables',
        vscode.TreeItemCollapsibleState.Collapsed
      ) as VercelTreeItem;
      devCategory.contextValue = 'category';
      devCategory.iconPath = new vscode.ThemeIcon('terminal');
      devCategory.data = { env: 'development' };

      return [prodCategory, prevCategory, devCategory];
    }

    if (element.contextValue === 'category') {
      const targetEnv = (element.data as { env: 'production' | 'preview' | 'development' }).env;
      try {
        const envs = await this.client.environments.listEnvironmentVariables(config.projectId);
        const filtered = envs.filter((e) => e.target.includes(targetEnv));

        if (filtered.length === 0) {
          const emptyItem: VercelTreeItem = new vscode.TreeItem(
            'No variables configured',
            vscode.TreeItemCollapsibleState.None
          ) as VercelTreeItem;
          emptyItem.contextValue = 'info';
          return [emptyItem];
        }

        return filtered.map((e) => this.createEnvItem(e));
      } catch {
        const errItem: VercelTreeItem = new vscode.TreeItem(
          'Failed to load environment variables',
          vscode.TreeItemCollapsibleState.None
        ) as VercelTreeItem;
        errItem.contextValue = 'info';
        return [errItem];
      }
    }

    return [];
  }

  private createEnvItem(env: VercelEnvVariable): VercelTreeItem {
    const item: VercelTreeItem = new vscode.TreeItem(
      env.key,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;

    item.contextValue = 'envVariable';
    item.description = '••••••••';
    item.tooltip = `Type: ${env.type}\nScopes: ${env.target.join(', ')}\nLast Updated: ${env.updatedAt ? new Date(env.updatedAt).toLocaleDateString() : 'N/A'}`;
    item.iconPath = new vscode.ThemeIcon(env.type === 'plain' ? 'symbol-variable' : 'lock');
    item.data = env;

    return item;
  }
}
