import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VercelClient } from '../api/vercelClient';
import { WorkspaceProjectConfig } from '../types/extension';
import { VercelDeployment, VercelProject } from '../types/vercel';
import { DiagnosticsEngine } from '../diagnostics/diagnosticsEngine';
import { DriftDetector } from '../project/driftDetector';
import { CapabilityRegistry } from '../capabilities';
import { VercelAiAssistant } from '../ai/assistant';
import { LogViewer } from '../views/logViewer';
import { TokenManager } from '../auth/tokenManager';

export function registerDiagnosticCommands(
  context: vscode.ExtensionContext,
  client: VercelClient,
  tokenManager: TokenManager,
  getProjectConfig: () => WorkspaceProjectConfig | null,
  logViewer: LogViewer,
  onRefresh: () => void
): void {
  // Diagnose Deployment
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.diagnoseDeployment', async (dep?: VercelDeployment) => {
      const config = getProjectConfig();
      if (!config) return;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Analyzing deployment diagnostics...'
        },
        async () => {
          let targetDep = dep;
          if (!targetDep) {
            const deps = await client.deployments.listDeployments(config.projectId, 1);
            targetDep = deps[0];
          }

          if (!targetDep) {
            vscode.window.showInformationMessage('No deployments found to diagnose.');
            return;
          }

          const events = await client.logs.getBuildEvents(targetDep.uid, 200);
          const rawLogs = events.map((e) => e.payload?.text || '').join('\n');
          const envs = await client.environments.listEnvironmentVariables(config.projectId);
          const domains = await client.domains.listDomains(config.projectId);

          // 1. Run deterministic heuristics
          const diagnostics = DiagnosticsEngine.runDiagnostics({
            logs: rawLogs,
            envs,
            targetEnv: targetDep.target === 'production' ? 'production' : 'preview',
            domains
          });

          if (diagnostics.length === 0) {
            const askAi = await vscode.window.showInformationMessage(
              `Deterministic analysis found no common errors in deployment '${targetDep.url}'. Would you like the Vercel AI Assistant to review the build logs?`,
              'Ask AI Assistant',
              'View Logs'
            );

            if (askAi === 'Ask AI Assistant') {
              const explanation = await VercelAiAssistant.explainBuildFailure(config.projectName || 'project', rawLogs);
              if (explanation) {
                vscode.window.showInformationMessage(
                  `AI Diagnosis: ${explanation.summary}\n\nCause: ${explanation.likelyRootCause}\n\nFix: ${explanation.recommendedFix}`,
                  { modal: true }
                );
              }
            } else if (askAi === 'View Logs') {
              logViewer.renderBuildEvents(events, targetDep.url);
            }
            return;
          }

          // Show diagnostic results
          const first = diagnostics[0];
          const choice = await vscode.window.showWarningMessage(
            `Diagnostic Found: [${first.category}] ${first.problem}\n\nLikely Cause: ${first.likelyCause}`,
            { modal: true },
            'Apply Suggested Fix',
            'View Build Logs',
            'Ask AI Assistant'
          );

          if (choice === 'View Build Logs') {
            logViewer.renderBuildEvents(events, targetDep.url);
          } else if (choice === 'Ask AI Assistant') {
            const explanation = await VercelAiAssistant.explainBuildFailure(config.projectName || 'project', rawLogs);
            if (explanation) {
              vscode.window.showInformationMessage(
                `AI Diagnosis: ${explanation.summary}\n\nCause: ${explanation.likelyRootCause}\n\nFix: ${explanation.recommendedFix}`,
                { modal: true }
              );
            }
          } else if (choice === 'Apply Suggested Fix') {
            vscode.window.showInformationMessage(`Suggested Fix: ${first.suggestedFix}`);
          }
        }
      );
    })
  );

  // Detect Configuration Drift
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.detectDrift', async () => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        const remoteProject = await client.projects.getProject(config.projectId);
        const drifts = DriftDetector.detectDrift(config.rootPath, remoteProject);

        if (drifts.length === 0) {
          vscode.window.showInformationMessage('No configuration drift detected! Local project and Vercel cloud settings are in sync.');
          return;
        }

        const report = drifts
          .map((d) => `• ${d.property}: Local='${d.localValue}' vs Cloud='${d.remoteValue}'\n  → ${d.recommendation}`)
          .join('\n\n');

        vscode.window.showWarningMessage(`Configuration Drift Detected:\n\n${report}`, { modal: true });
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to check configuration drift: ${(err as Error).message}`);
      }
    })
  );

  // Feature Support
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.featureSupport', async () => {
      const caps = CapabilityRegistry.getAll();
      const lines = ['=== Vercel Control Center Feature Support Matrix ===\n'];

      for (const cap of caps) {
        let badge = '✓ Fully Supported';
        if (cap.supportLevel === 'PARTIAL') badge = '◐ Partially Supported (API/CLI)';
        if (cap.supportLevel === 'DASHBOARD') badge = '→ Dashboard Fallback';
        lines.push(`[${badge}] ${cap.name.padEnd(25)} Category: ${cap.category}`);
        if (cap.notes) lines.push(`     Note: ${cap.notes}`);
      }

      const channel = vscode.window.createOutputChannel('Vercel Feature Support');
      channel.clear();
      channel.appendLine(lines.join('\n'));
      channel.show();
    })
  );

  // View Build Logs
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.viewBuildLogs', async (dep?: VercelDeployment) => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        let targetDep = dep;
        if (!targetDep) {
          const deps = await client.deployments.listDeployments(config.projectId, 1);
          targetDep = deps[0];
        }

        if (!targetDep) {
          vscode.window.showInformationMessage('No deployments found.');
          return;
        }

        const events = await client.logs.getBuildEvents(targetDep.uid, 200);
        logViewer.renderBuildEvents(events, targetDep.url);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to fetch build logs: ${(err as Error).message}`);
      }
    })
  );

  // View Runtime Logs
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.viewRuntimeLogs', async (dep?: VercelDeployment) => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        let targetDep = dep;
        if (!targetDep) {
          const deps = await client.deployments.listDeployments(config.projectId, 1);
          targetDep = deps[0];
        }

        if (!targetDep) return;

        const logs = await client.logs.getRuntimeLogs(config.projectId, targetDep.uid, 50);
        logViewer.renderRuntimeLogs(logs, targetDep.uid);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to fetch runtime logs: ${(err as Error).message}`);
      }
    })
  );

  // Open Project in Dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.openProject', async () => {
      const config = getProjectConfig();
      if (!config) return;
      vscode.env.openExternal(vscode.Uri.parse(`https://vercel.com/~/projects/${config.projectName || config.projectId}`));
    })
  );

  // Open Production Deployment
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.openProduction', async () => {
      const config = getProjectConfig();
      if (!config) return;

      try {
        const project = await client.projects.getProject(config.projectId);
        const url = project.targets?.production?.url;
        if (url) {
          vscode.env.openExternal(vscode.Uri.parse(`https://${url}`));
        } else {
          vscode.window.showInformationMessage('No active production deployment found.');
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to open production: ${(err as Error).message}`);
      }
    })
  );

  // Open Dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.openDashboard', async () => {
      vscode.env.openExternal(vscode.Uri.parse('https://vercel.com/dashboard'));
    })
  );

  // Link Project
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.linkProject', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const token = await tokenManager.getAccessToken();
      if (!token) {
        const loginAction = await vscode.window.showWarningMessage(
          'You must log in to Vercel before linking a project.',
          'Log In'
        );
        if (loginAction === 'Log In') {
          await vscode.commands.executeCommand('vercel.login');
        }
        return;
      }

      // Fetch projects from user's account to allow 1-click selection
      let projects: VercelProject[] = [];
      try {
        projects = await client.projects.listProjects(100);
      } catch {
        // If API fails or offline, fall back to terminal CLI option
      }

      interface LinkQuickPickItem extends vscode.QuickPickItem {
        project?: VercelProject;
        action?: 'terminal';
      }

      const items: LinkQuickPickItem[] = [];

      for (const p of projects) {
        items.push({
          label: `$(cloud) ${p.name}`,
          description: p.framework ? `${p.framework} • ID: ${p.id}` : `ID: ${p.id}`,
          detail: `Team/Account: ${p.accountId}`,
          project: p
        });
      }

      items.push({
        label: '$(terminal) Run "vercel link" in Integrated Terminal...',
        description: 'Interactive CLI setup for new or existing project',
        action: 'terminal'
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Vercel project to link with this workspace',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selected) {
        return;
      }

      if (selected.project) {
        const p = selected.project;
        try {
          const vercelDir = path.join(root, '.vercel');
          if (!fs.existsSync(vercelDir)) {
            fs.mkdirSync(vercelDir, { recursive: true });
          }

          const projectConfigData = {
            orgId: p.accountId,
            projectId: p.id,
            projectName: p.name
          };

          fs.writeFileSync(
            path.join(vercelDir, 'project.json'),
            JSON.stringify(projectConfigData, null, 2),
            'utf8'
          );

          // Ensure .vercel is in .gitignore
          const gitignorePath = path.join(root, '.gitignore');
          if (fs.existsSync(gitignorePath)) {
            try {
              const content = fs.readFileSync(gitignorePath, 'utf8');
              if (!content.includes('.vercel')) {
                fs.appendFileSync(gitignorePath, '\n.vercel\n', 'utf8');
              }
            } catch {
              // Ignore gitignore read/write errors
            }
          }

          vscode.window.showInformationMessage(`Successfully linked workspace to Vercel project "${p.name}"!`);
          onRefresh();
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to link project: ${(err as Error).message}`);
        }
      } else if (selected.action === 'terminal') {
        const terminal = vscode.window.createTerminal({
          name: 'Vercel Link',
          cwd: root
        });
        terminal.show();
        const activeTeamId = tokenManager.getActiveTeamId();
        const teamFlag = activeTeamId ? ` --scope ${activeTeamId}` : '';
        const tokenFlag = token ? ` --token ${token}` : '';
        terminal.sendText(`vercel link${teamFlag}${tokenFlag}`);
        vscode.window.showInformationMessage('Complete the prompts in the terminal to link your project. Once finished, click refresh in the Vercel view.');
      }
    })
  );

  // Unlink Project
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.unlinkProject', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const projectJsonPath = path.join(root, '.vercel', 'project.json');
      if (!fs.existsSync(projectJsonPath)) {
        vscode.window.showInformationMessage('Workspace is not currently linked to any Vercel project.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to unlink this workspace from the Vercel project?',
        { modal: true },
        'Unlink'
      );
      if (confirm !== 'Unlink') return;

      try {
        fs.unlinkSync(projectJsonPath);
        vscode.window.showInformationMessage('Workspace unlinked from Vercel.');
        onRefresh();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to unlink project: ${(err as Error).message}`);
      }
    })
  );
}
