import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { TokenManager } from '../auth/tokenManager';
import { VercelCliRunner } from '../cli/vercelCli';
import { WorkspaceProjectConfig } from '../types/extension';
import { VercelDeployment } from '../types/vercel';
import { LogViewer } from '../views/logViewer';

export function registerDeploymentCommands(
  context: vscode.ExtensionContext,
  client: VercelClient,
  tokenManager: TokenManager,
  getProjectConfig: () => WorkspaceProjectConfig | null,
  logViewer: LogViewer,
  onDeploymentTriggered: () => void
): void {
  // Deploy General
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.deploy', async () => {
      const config = getProjectConfig();
      if (!config) {
        vscode.window.showErrorMessage('Workspace is not linked to a Vercel project.');
        return;
      }

      const target = await vscode.window.showQuickPick(
        [
          { label: '$(git-pull-request) Preview', description: 'Deploy preview build', isProd: false },
          { label: '$(server-environment) Production', description: 'Deploy directly to production domains', isProd: true }
        ],
        { placeHolder: 'Select deployment target environment' }
      );

      if (!target) return;

      if (target.isProd) {
        vscode.commands.executeCommand('vercel.deployProd');
      } else {
        vscode.commands.executeCommand('vercel.deployPreview');
      }
    })
  );

  // Deploy Preview
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.deployPreview', async () => {
      const config = getProjectConfig();
      if (!config) return;

      logViewer.clear();
      logViewer.show();
      logViewer.append(`▲ Starting Vercel Preview Deployment for ${config.projectName || 'project'}...\n`);

      const token = await tokenManager.getAccessToken();
      const res = await VercelCliRunner.execute(['deploy', '--yes'], config.rootPath, token, (chunk) => {
        logViewer.append(chunk);
      });

      if (res.exitCode === 0) {
        vscode.window.showInformationMessage('Vercel Preview Deployment created successfully!');
        onDeploymentTriggered();
      } else {
        vscode.window.showErrorMessage('Preview Deployment failed. Check Vercel Logs for details.');
      }
    })
  );

  // Deploy Production
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.deployProd', async () => {
      const config = getProjectConfig();
      if (!config) return;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to deploy directly to PRODUCTION for '${config.projectName || 'current project'}'?`,
        { modal: true },
        'Deploy to Production'
      );
      if (confirm !== 'Deploy to Production') return;

      logViewer.clear();
      logViewer.show();
      logViewer.append(`▲ Starting Vercel PRODUCTION Deployment...\n`);

      const token = await tokenManager.getAccessToken();
      const res = await VercelCliRunner.execute(['deploy', '--prod', '--yes'], config.rootPath, token, (chunk) => {
        logViewer.append(chunk);
      });

      if (res.exitCode === 0) {
        vscode.window.showInformationMessage('Vercel Production Deployment completed!');
        onDeploymentTriggered();
      } else {
        vscode.window.showErrorMessage('Production Deployment failed.');
      }
    })
  );

  // Deploy Dry Run
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.deployDryRun', async () => {
      const config = getProjectConfig();
      if (!config) return;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Running Vercel Dry-Run inspection...'
        },
        async () => {
          const token = await tokenManager.getAccessToken();
          const result = await VercelCliRunner.runDryRun(config.rootPath, token);

          const sizeMb = (result.totalSize / (1024 * 1024)).toFixed(2);
          let msg = `Dry Run Summary: ${result.totalFiles} files (${sizeMb} MB). Framework: ${result.framework || 'Auto'}.`;

          if (result.largeFiles.length > 0) {
            msg += ` Found ${result.largeFiles.length} files > 5MB.`;
          }

          const action = await vscode.window.showInformationMessage(msg, 'View Included Files', 'Deploy Now');
          if (action === 'View Included Files') {
            logViewer.clear();
            logViewer.show();
            logViewer.appendLine('=== Vercel Dry Run Included Files ===');
            for (const f of result.includedFiles) {
              logViewer.appendLine(`+ ${f}`);
            }
          } else if (action === 'Deploy Now') {
            vscode.commands.executeCommand('vercel.deployPreview');
          }
        }
      );
    })
  );

  // Redeploy
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.redeploy', async () => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        const deployments = await client.deployments.listDeployments(config.projectId, 10);
        const items = deployments.map((d) => ({
          label: d.url,
          description: `${d.state} (${d.target || 'preview'})`,
          detail: `Commit: ${d.meta?.githubCommitSha?.substring(0, 7) || 'N/A'} - ${d.meta?.githubCommitMessage || ''}`,
          deployment: d
        }));

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a deployment to redeploy'
        });

        if (picked) {
          const token = await tokenManager.getAccessToken();
          logViewer.clear();
          logViewer.show();
          logViewer.append(`▲ Rebuilding deployment ${picked.deployment.url}...\n`);

          const res = await VercelCliRunner.execute(['redeploy', picked.deployment.uid, '--yes'], config.rootPath, token, (chunk) => {
            logViewer.append(chunk);
          });

          if (res.exitCode === 0) {
            vscode.window.showInformationMessage(`Redeploy triggered for ${picked.deployment.url}!`);
            onDeploymentTriggered();
          } else {
            vscode.window.showErrorMessage('Redeploy failed.');
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to fetch deployments: ${(err as Error).message}`);
      }
    })
  );

  // Rollback
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.rollback', async () => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        const deployments = await client.deployments.listDeployments(config.projectId, 15);
        const prodDeployments = deployments.filter((d) => d.target === 'production' && d.state === 'READY');

        if (prodDeployments.length < 2) {
          vscode.window.showWarningMessage('Not enough previous production deployments available for rollback.');
          return;
        }

        // Exclude current production (index 0)
        const candidates = prodDeployments.slice(1);
        const items = candidates.map((d) => ({
          label: d.url,
          description: new Date(d.created).toLocaleString(),
          detail: `Commit: ${d.meta?.githubCommitSha?.substring(0, 7) || ''} - ${d.meta?.githubCommitMessage || ''}`,
          deployment: d
        }));

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a previous production deployment to roll back to'
        });

        if (picked) {
          const confirm = await vscode.window.showWarningMessage(
            `Instantly roll back Production to ${picked.deployment.url}?`,
            { modal: true },
            'Rollback'
          );

          if (confirm === 'Rollback') {
            await client.deployments.rollback(config.projectId, picked.deployment.uid);
            vscode.window.showInformationMessage(`Instant Rollback to ${picked.deployment.url} initiated!`);
            onDeploymentTriggered();
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Rollback failed: ${(err as Error).message}`);
      }
    })
  );

  // Cancel Deployment
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.cancelDeployment', async (dep?: VercelDeployment) => {
      if (!dep) return;
      const confirm = await vscode.window.showWarningMessage(
        `Cancel in-progress build for ${dep.url}?`,
        { modal: true },
        'Cancel Deployment'
      );
      if (confirm !== 'Cancel Deployment') return;

      try {
        await client.deployments.cancelDeployment(dep.uid);
        vscode.window.showInformationMessage(`Deployment ${dep.url} canceled.`);
        onDeploymentTriggered();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to cancel deployment: ${(err as Error).message}`);
      }
    })
  );

  // Inspect Deployment
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.inspectDeployment', async (dep?: VercelDeployment) => {
      if (!dep) return;

      const actions = [
        'Open Deployment URL',
        'View Build Logs',
        'View Runtime Logs',
        'Diagnose Deployment',
        'Copy Deployment URL',
        'Cancel Deployment'
      ];

      const picked = await vscode.window.showQuickPick(actions, {
        placeHolder: `Deployment: ${dep.url} (${dep.state})`
      });

      if (picked === 'Open Deployment URL') {
        vscode.env.openExternal(vscode.Uri.parse(`https://${dep.url}`));
      } else if (picked === 'View Build Logs') {
        vscode.commands.executeCommand('vercel.viewBuildLogs', dep);
      } else if (picked === 'View Runtime Logs') {
        vscode.commands.executeCommand('vercel.viewRuntimeLogs', dep);
      } else if (picked === 'Diagnose Deployment') {
        vscode.commands.executeCommand('vercel.diagnoseDeployment', dep);
      } else if (picked === 'Copy Deployment URL') {
        await vscode.env.clipboard.writeText(`https://${dep.url}`);
        vscode.window.showInformationMessage('Deployment URL copied to clipboard.');
      } else if (picked === 'Cancel Deployment') {
        vscode.commands.executeCommand('vercel.cancelDeployment', dep);
      }
    })
  );
}
