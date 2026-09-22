import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { VercelTreeItem } from '../types/extension';
import { VercelProject } from '../types/vercel';

export class ProjectsTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VercelTreeItem | undefined | null | void> =
    new vscode.EventEmitter<VercelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<VercelTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private client: VercelClient) {}

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

    try {
      const projects = await this.client.projects.listProjects(50);
      if (projects.length === 0) {
        const item: VercelTreeItem = new vscode.TreeItem(
          'No projects found in this scope',
          vscode.TreeItemCollapsibleState.None
        ) as VercelTreeItem;
        item.contextValue = 'info';
        return [item];
      }

      return projects.map((p) => this.createProjectItem(p));
    } catch {
      const errItem: VercelTreeItem = new vscode.TreeItem(
        'Failed to load projects (Login required)',
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      errItem.contextValue = 'action';
      errItem.command = {
        command: 'vercel.login',
        title: 'Login'
      };
      return [errItem];
    }
  }

  private createProjectItem(proj: VercelProject): VercelTreeItem {
    const item: VercelTreeItem = new vscode.TreeItem(
      proj.name,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;

    item.contextValue = 'project';
    item.iconPath = new vscode.ThemeIcon('folder');
    item.description = proj.framework || '';
    item.tooltip = `ID: ${proj.id}\nFramework: ${proj.framework || 'Other'}\nUpdated: ${proj.updatedAt ? new Date(proj.updatedAt).toLocaleDateString() : 'N/A'}`;
    item.data = proj;
    item.command = {
      command: 'vscode.open',
      title: 'Open in Dashboard',
      arguments: [vscode.Uri.parse(`https://vercel.com/~/projects/${proj.name}`)]
    };

    return item;
  }
}
