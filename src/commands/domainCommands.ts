import * as vscode from 'vscode';
import { VercelClient } from '../api/vercelClient';
import { WorkspaceProjectConfig } from '../types/extension';
import { VercelDomain } from '../types/vercel';

export function registerDomainCommands(
  context: vscode.ExtensionContext,
  client: VercelClient,
  getProjectConfig: () => WorkspaceProjectConfig | null,
  onRefresh: () => void
): void {
  // Manage Domains
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.manageDomains', async () => {
      const config = getProjectConfig();
      if (!config) return;

      const action = await vscode.window.showQuickPick(['Add Custom Domain', 'Open Domains in Dashboard'], {
        placeHolder: 'Select Domain Action'
      });

      if (action === 'Add Custom Domain') {
        const domain = await vscode.window.showInputBox({
          title: 'Custom Domain',
          prompt: 'Enter domain (e.g. app.mydomain.com)',
          validateInput: (v: string) => (!v.trim() ? 'Domain cannot be empty' : null)
        });

        if (domain) {
          try {
            await client.domains.addDomain(config.projectId, domain);
            vscode.window.showInformationMessage(`Domain '${domain}' added to project!`);
            onRefresh();
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to add domain: ${(err as Error).message}`);
          }
        }
      } else if (action === 'Open Domains in Dashboard') {
        vscode.commands.executeCommand('vercel.openDashboard');
      }
    })
  );

  // Verify Domain
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.verifyDomain', async (domain?: VercelDomain) => {
      const config = getProjectConfig();
      if (!config) return;

      let targetDomain = domain?.name;
      if (!targetDomain) {
        targetDomain = await vscode.window.showInputBox({
          title: 'Verify Domain',
          prompt: 'Enter domain name to verify'
        });
      }

      if (!targetDomain) return;

      try {
        const res = await client.domains.verifyDomain(config.projectId, targetDomain);
        if (res.verified) {
          vscode.window.showInformationMessage(`Domain '${targetDomain}' verified successfully!`);
        } else {
          vscode.window.showWarningMessage(
            `Domain '${targetDomain}' is still unverified. Please check your DNS records.`
          );
        }
        onRefresh();
      } catch (err) {
        vscode.window.showErrorMessage(`Verification failed: ${(err as Error).message}`);
      }
    })
  );

  // Diagnose DNS
  context.subscriptions.push(
    vscode.commands.registerCommand('vercel.diagnoseDns', async (domain?: VercelDomain) => {
      const name = domain?.name || 'your domain';
      const isApex = domain?.name === domain?.apexName;

      let guidance = `DNS Configuration Guide for ${name}:\n\n`;
      if (isApex) {
        guidance += `Apex Domain (${name}):\n`;
        guidance += `Type:  A Record\nName:  @ (or empty)\nValue: 76.76.21.21\nTTL:   60 seconds\n`;
      } else {
        guidance += `Subdomain (${name}):\n`;
        guidance += `Type:  CNAME\nName:  ${name.split('.')[0]}\nValue: cname.vercel-dns.com\nTTL:   60 seconds\n`;
      }

      const action = await vscode.window.showInformationMessage(
        guidance,
        { modal: true },
        'Verify Domain Now',
        'Open DNS Settings'
      );

      if (action === 'Verify Domain Now') {
        vscode.commands.executeCommand('vercel.verifyDomain', domain);
      } else if (action === 'Open DNS Settings') {
        vscode.commands.executeCommand('vercel.openDashboard');
      }
    })
  );
}
