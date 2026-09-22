import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { TokenManager } from '../auth/tokenManager';
import { VercelCliRunner } from '../cli/vercelCli';
import { WorkspaceProjectConfig } from '../types/extension';

export function registerEnvCommands(
  context: vscode.ExtensionContext,
  client: VercelClient,
  tokenManager: TokenManager,
  getProjectConfig: () => WorkspaceProjectConfig | null,
  onRefresh: () => void
): void {
  // Pull Environment Variables
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.pullEnv', async () => {
      const config = getProjectConfig();
      if (!config) {
        vscode.window.showErrorMessage('Workspace is not linked to a Vercel project.');
        return;
      }

      const envChoice = await vscode.window.showQuickPick(
        [
          { label: 'development', description: 'Pull to .env.development.local' },
          { label: 'preview', description: 'Pull to .env.preview.local' },
          { label: 'production', description: 'Pull to .env.production.local' }
        ],
        { placeHolder: 'Select target environment to pull' }
      );

      if (!envChoice) return;

      const token = await tokenManager.getAccessToken();
      const res = await VercelCliRunner.pullEnv(
        config.rootPath,
        envChoice.label as 'development' | 'preview' | 'production',
        token
      );

      if (res.exitCode === 0) {
        vscode.window.showInformationMessage(`Successfully pulled ${envChoice.label} environment variables!`);
      } else {
        vscode.window.showErrorMessage(`Failed to pull variables: ${res.stderr || res.stdout}`);
      }
    })
  );

  // Push Environment Variables
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.pushEnv', async () => {
      const config = getProjectConfig();
      if (!config) return;

      vscode.window.showInformationMessage(
        'To push local environment variables, use "Vercel: Add Environment Variable" or push via Vercel CLI in terminal.'
      );
    })
  );

  // Compare Environments
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.compareEnv', async () => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        const envs = await client.environments.listEnvironmentVariables(config.projectId);
        const prodVars = new Set(envs.filter((e) => e.target.includes('production')).map((e) => e.key));
        const prevVars = new Set(envs.filter((e) => e.target.includes('preview')).map((e) => e.key));

        const allKeys = Array.from(new Set([...Array.from(prodVars), ...Array.from(prevVars)])).sort();

        const diffLines: string[] = ['=== Vercel Environment Comparison (Preview vs Production) ===\n'];
        for (const key of allKeys) {
          const inProd = prodVars.has(key);
          const inPrev = prevVars.has(key);

          if (inProd && inPrev) {
            diffLines.push(`[✓] ${key.padEnd(25)} Production: exists  | Preview: exists`);
          } else if (inProd && !inPrev) {
            diffLines.push(`[!] ${key.padEnd(25)} Production: exists  | Preview: MISSING`);
          } else {
            diffLines.push(`[!] ${key.padEnd(25)} Production: MISSING | Preview: exists`);
          }
        }

        const channel = vscode.window.createOutputChannel('Vercel Environment Diff');
        channel.clear();
        channel.appendLine(diffLines.join('\n'));
        channel.show();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to compare environments: ${(err as Error).message}`);
      }
    })
  );

  // Add Environment Variable
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.addEnv', async () => {
      const config = getProjectConfig();
      if (!config) return;

      const key = await vscode.window.showInputBox({
        title: 'Variable Key',
        prompt: 'e.g. DATABASE_URL, NEXT_PUBLIC_API_URL',
        validateInput: (v: string) => (!v.trim() ? 'Key cannot be empty' : null)
      });
      if (!key) return;

      const value = await vscode.window.showInputBox({
        title: 'Variable Value',
        prompt: 'Enter value',
        password: true
      });
      if (value === undefined) return;

      const targets = await vscode.window.showQuickPick(
        [
          { label: 'Production', picked: true, target: 'production' },
          { label: 'Preview', picked: true, target: 'preview' },
          { label: 'Development', picked: true, target: 'development' }
        ],
        { canPickMany: true, placeHolder: 'Select targets' }
      );
      if (!targets || targets.length === 0) return;

      try {
        await client.environments.createEnvironmentVariable(config.projectId, {
          key,
          value,
          type: 'encrypted',
          target: targets.map((t) => t.target as 'production' | 'preview' | 'development')
        });

        vscode.window.showInformationMessage(`Added variable '${key}' successfully!`);
        onRefresh();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to add variable: ${(err as Error).message}`);
      }
    })
  );
}
