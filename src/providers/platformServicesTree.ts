import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { VercelTreeItem } from '../types/extension';
import { CapabilityRegistry } from '../capabilities';

export class PlatformServicesTreeDataProvider implements vscode.TreeDataProvider<VercelTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VercelTreeItem | undefined | null | void> =
    new vscode.EventEmitter<VercelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<VercelTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private client: VercelClient,
    private getProjectId: () => string | undefined
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

    const items: VercelTreeItem[] = [];

    // 1. WAF & Firewall
    const firewallCap = CapabilityRegistry.get('firewall');
    const firewallItem: VercelTreeItem = new vscode.TreeItem(
      'Firewall & WAF: Managed Rules (Active)',
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    firewallItem.contextValue = 'platformService';
    firewallItem.iconPath = new vscode.ThemeIcon('shield');
    firewallItem.tooltip = 'OWASP Managed Rules (SQLi, XSS, Scanner Detection) enabled';
    firewallItem.command = {
      command: 'vscode.open',
      title: 'Open Firewall Settings',
      arguments: [vscode.Uri.parse(firewallCap?.dashboardFallbackUrl?.replace('[team]', '~').replace('[project]', this.getProjectId() || '') || 'https://vercel.com')]
    };
    items.push(firewallItem);

    // 2. Vercel Blob
    const blobStores = await this.client.platform.listBlobStores();
    const blobItem: VercelTreeItem = new vscode.TreeItem(
      `Vercel Blob (${blobStores.length} stores)`,
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    blobItem.contextValue = 'platformService';
    blobItem.iconPath = new vscode.ThemeIcon('database');
    blobItem.tooltip = 'Global object storage for files and media assets';
    blobItem.command = {
      command: 'vscode.open',
      title: 'Open Blob Stores',
      arguments: [vscode.Uri.parse('https://vercel.com/~/stores/blob')]
    };
    items.push(blobItem);

    // 3. Vercel Queues
    const queueItem: VercelTreeItem = new vscode.TreeItem(
      'Vercel Queues (Serverless)',
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    queueItem.contextValue = 'platformService';
    queueItem.iconPath = new vscode.ThemeIcon('layers');
    queueItem.command = {
      command: 'vscode.open',
      title: 'Open Queues Console',
      arguments: [vscode.Uri.parse('https://vercel.com/~/queues')]
    };
    items.push(queueItem);

    // 4. AI Gateway
    const aiItem: VercelTreeItem = new vscode.TreeItem(
      'AI Gateway (Unified Models)',
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    aiItem.contextValue = 'platformService';
    aiItem.iconPath = new vscode.ThemeIcon('hubot');
    aiItem.command = {
      command: 'vscode.open',
      title: 'Open AI Gateway',
      arguments: [vscode.Uri.parse('https://vercel.com/~/ai-gateway')]
    };
    items.push(aiItem);

    // 5. BotID Protection
    const botItem: VercelTreeItem = new vscode.TreeItem(
      'BotID Protection (Integration Ready)',
      vscode.TreeItemCollapsibleState.None
    ) as VercelTreeItem;
    botItem.contextValue = 'platformService';
    botItem.iconPath = new vscode.ThemeIcon('verified');
    botItem.command = {
      command: 'vscode.open',
      title: 'View Bot Management Docs',
      arguments: [vscode.Uri.parse('https://vercel.com/docs/security/bot-management')]
    };
    items.push(botItem);

    return items;
  }
}
