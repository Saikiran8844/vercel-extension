import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { VercelTreeItem } from '../types/extension';
import { VercelTeam, VercelUser } from '../types/vercel';

export class TeamsTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VercelTreeItem | undefined | null | void> =
    new vscode.EventEmitter<VercelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<VercelTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private client: VercelClient,
    private getActiveTeamId: () => string | undefined
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

    try {
      const user: VercelUser = await this.client.auth.getCurrentUser();
      const teams: VercelTeam[] = await this.client.auth.getTeams();
      const activeTeamId = this.getActiveTeamId();

      const items: VercelTreeItem[] = [];

      // Personal Account
      const isPersonalActive = !activeTeamId;
      const personalItem: VercelTreeItem = new vscode.TreeItem(
        `Personal (${user.username || user.email})`,
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      personalItem.contextValue = 'team';
      personalItem.iconPath = new vscode.ThemeIcon(isPersonalActive ? 'pass-filled' : 'account');
      personalItem.description = isPersonalActive ? 'Active Scope' : '';
      personalItem.command = {
        command: 'vercel.switchAccount',
        title: 'Switch Scope'
      };
      items.push(personalItem);

      // Teams
      for (const t of teams) {
        const isTeamActive = activeTeamId === t.id;
        const teamItem: VercelTreeItem = new vscode.TreeItem(
          t.name,
          vscode.TreeItemCollapsibleState.None
        ) as VercelTreeItem;
        teamItem.contextValue = 'team';
        teamItem.iconPath = new vscode.ThemeIcon(isTeamActive ? 'pass-filled' : 'organization');
        teamItem.description = isTeamActive ? 'Active Scope' : (t.membership?.role || '');
        teamItem.tooltip = `Team ID: ${t.id}\nRole: ${t.membership?.role || 'Member'}`;
        teamItem.data = t;
        teamItem.command = {
          command: 'vercel.switchAccount',
          title: 'Switch Scope'
        };
        items.push(teamItem);
      }

      return items;
    } catch {
      const item: VercelTreeItem = new vscode.TreeItem(
        'Log in to view Teams & Accounts',
        vscode.TreeItemCollapsibleState.None
      ) as VercelTreeItem;
      item.contextValue = 'action';
      item.iconPath = new vscode.ThemeIcon('key');
      item.command = {
        command: 'vercel.login',
        title: 'Log In'
      };
      return [item];
    }
  }
}
