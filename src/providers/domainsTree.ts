import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { WorkspaceProjectConfig, VercelTreeItem } from '../types/extension';
import { VercelDomain } from '../types/vercel';

export class DomainsTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
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
    if (element) {
      return [];
    }

    const config = this.getProjectConfig();
    if (!config) {
      return [];
    }

    try {
      const domains = await this.client.domains.listDomains(config.projectId);
      if (domains.length === 0) {
        const emptyItem: VercelTreeItem = new vscode.TreeItem(
          'No custom domains assigned',
          vscode.TreeItemCollapsibleState.None
        ) as VercelTreeItem;
        emptyItem.contextValue = 'info';
        return [emptyItem];
      }

      return domains.map((domain) => this.createDomainItem(domain));
    } catch {
      const errItem: VercelTreeItem = new vscode.TreeItem(
        'Failed to load domains',
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      errItem.contextValue = 'info';
      return [errItem];
    }
  }

  private createDomainItem(domain: VercelDomain): VercelTreeItem {
    const item: VercelTreeItem = new vscode.TreeItem(
      domain.name,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;

    item.contextValue = 'domain';
    item.iconPath = new vscode.ThemeIcon(domain.verified ? 'verified' : 'warning');
    item.description = domain.verified ? 'Verified (SSL Active)' : 'Unverified DNS';
    item.tooltip = `Domain: ${domain.name}\nApex: ${domain.apexName}\nStatus: ${domain.verified ? 'Valid' : 'Action Required'}`;
    item.data = domain;
    item.command = {
      command: domain.verified ? 'vscode.open' : 'vercel.diagnoseDns',
      title: domain.verified ? 'Open Domain' : 'Diagnose DNS',
      arguments: domain.verified ? [vscode.Uri.parse(`https://${domain.name}`)] : [domain]
    };

    return item;
  }
}
