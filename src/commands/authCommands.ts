import * as vscode from 'vscode';
import { TokenManager } from '../auth/tokenManager';
import { VercelClient } from '../api/vercelClient';

export function registerAuthCommands(
  context: vscode.ExtensionContext,
  tokenManager: TokenManager,
  client: VercelClient,
  onStateChanged: () => void
): void {
  // Login
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.login', async () => {
      const token = await vscode.window.showInputBox({
        title: 'Vercel Personal Access Token',
        prompt: 'Enter your Vercel Access Token (from vercel.com/account/tokens)',
        password: true,
        ignoreFocusOut: true,
        validateInput: (v: string) => (!v.trim() ? 'Token cannot be empty' : null)
      });

      if (!token) return;

      try {
        await tokenManager.setAccessToken(token);
        client.invalidateAllCache();
        const user = await client.auth.getCurrentUser();
        vscode.window.showInformationMessage(`Successfully logged in as ${user.name || user.username || user.email}!`);
        onStateChanged();
      } catch (err) {
        await tokenManager.deleteAccessToken();
        vscode.window.showErrorMessage(`Authentication failed: ${(err as Error).message}`);
      }
    })
  );

  // Logout
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.logout', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to log out of Vercel?',
        { modal: true },
        'Log Out'
      );
      if (confirm !== 'Log Out') return;

      await tokenManager.deleteAccessToken();
      client.invalidateAllCache();
      vscode.window.showInformationMessage('Logged out of Vercel.');
      onStateChanged();
    })
  );

  // Switch Account / Scope
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.switchAccount', async () => {
      try {
        const user = await client.auth.getCurrentUser();
        const teams = await client.auth.getTeams();
        const activeTeamId = tokenManager.getActiveTeamId();

        const personalItem: vscode.QuickPickItem & { teamId?: string } = {
          label: `$(account) Personal Account (${user.username || user.email})`
        };
        if (!activeTeamId) {
          personalItem.description = 'Currently Active';
        }

        const items: Array<vscode.QuickPickItem & { teamId?: string }> = [personalItem];

        for (const t of teams) {
          items.push({
            label: `$(organization) ${t.name}`,
            description: activeTeamId === t.id ? 'Currently Active' : (t.membership?.role || ''),
            detail: `Team ID: ${t.id}`,
            teamId: t.id
          });
        }

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a Vercel team or personal scope'
        });

        if (picked) {
          await tokenManager.setActiveTeamId(picked.teamId);
          client.invalidateAllCache();
          vscode.window.showInformationMessage(`Switched scope to: ${picked.label.replace(/^\$\([a-z-]+\)\s*/, '')}`);
          onStateChanged();
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to switch team: ${(err as Error).message}`);
      }
    })
  );

  // Validate Authentication
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.validateAuth', async () => {
      const token = await tokenManager.getAccessToken();
      if (!token) {
        vscode.window.showWarningMessage('No Vercel Personal Access Token found. Run "Vercel: Login".');
        return;
      }

      try {
        const user = await client.auth.getCurrentUser();
        vscode.window.showInformationMessage(`Token valid. Authenticated as ${user.username || user.email}. Token: ${TokenManager.maskToken(token)}`);
      } catch (err) {
        vscode.window.showErrorMessage(`Token validation failed: ${(err as Error).message}`);
      }
    })
  );
}
