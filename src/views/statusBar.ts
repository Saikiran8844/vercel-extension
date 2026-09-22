import * as vscode from 'vscode';
import { VercelDeployment } from '../types/vercel';

export type StatusBarState = 'NOT_LOGGED_IN' | 'NOT_LINKED' | 'READY' | 'BUILDING' | 'ERROR' | 'OFFLINE';

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private currentInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    this.item.command = 'vercel.refresh';
    this.setState('NOT_LINKED');
    this.item.show();
  }

  public setState(state: StatusBarState, detail?: string, latestDeployment?: VercelDeployment): void {
    switch (state) {
      case 'NOT_LOGGED_IN':
        this.item.text = '$(key) Vercel: Log In';
        this.item.tooltip = 'Click to log in with a Vercel Personal Access Token';
        this.item.command = 'vercel.login';
        this.item.backgroundColor = undefined;
        break;

      case 'NOT_LINKED':
        this.item.text = '$(cloud-upload) Vercel: Link Project';
        this.item.tooltip = 'Workspace is not linked to a Vercel project. Click to link.';
        this.item.command = 'vercel.linkProject';
        this.item.backgroundColor = undefined;
        break;

      case 'BUILDING':
        this.item.text = `$(sync~spin) Vercel: Building${detail ? ` (${detail})` : ''}`;
        this.item.tooltip = `Deployment in progress${latestDeployment ? `: ${latestDeployment.url}` : ''}`;
        this.item.command = 'vercel.viewBuildLogs';
        this.item.backgroundColor = undefined;
        break;

      case 'READY':
        this.item.text = '$(cloud) Vercel: Ready';
        this.item.tooltip = `Production deployment is ready${latestDeployment ? ` (${latestDeployment.url})` : ''}`;
        this.item.command = 'vercel.openProduction';
        this.item.backgroundColor = undefined;
        break;

      case 'ERROR':
        this.item.text = '$(error) Vercel: Error';
        this.item.tooltip = `Deployment failed: ${detail || 'Click to view build logs'}`;
        this.item.command = 'vercel.diagnoseDeployment';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;

      case 'OFFLINE':
        this.item.text = '$(cloud-offline) Vercel: Offline';
        this.item.tooltip = 'Vercel API is currently unreachable. Operating in offline mode.';
        this.item.command = 'vercel.refresh';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
    }
  }

  public startPolling(pollFn: () => Promise<void>, isBuilding: boolean): void {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }

    const intervalMs = isBuilding ? 5000 : 30000;
    this.currentInterval = setInterval(async () => {
      try {
        await pollFn();
      } catch {
        // Handled in caller
      }
    }, intervalMs);
  }

  public dispose(): void {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    this.item.dispose();
  }
}
