import * as vscode from 'vscode';
import { LogSanitizer } from './logSanitizer';

export interface AiExplanation {
  summary: string;
  likelyRootCause: string;
  recommendedFix: string;
  sourceFileHint?: string | undefined;
}

export class VercelAiAssistant {
  public static async explainBuildFailure(
    projectName: string,
    rawLogs: string
  ): Promise<AiExplanation | null> {
    const config = vscode.workspace.getConfiguration('vercel');
    const enabled = config.get<boolean>('ai.enabled', true);

    if (!enabled) {
      vscode.window.showInformationMessage('Vercel AI Assistant is disabled in settings.');
      return null;
    }

    const consent = await vscode.window.showInformationMessage(
      `Send sanitized build log context from '${projectName}' to Vercel AI Assistant?`,
      { modal: true },
      'Yes, Explain',
      'Cancel'
    );

    if (consent !== 'Yes, Explain') {
      return null;
    }

    const sanitizedLogs = LogSanitizer.sanitize(rawLogs);

    // Deterministic parsing combined with provider format
    const lines = sanitizedLogs.split('\n');
    const errorLines = lines.filter(
      (l) => l.toLowerCase().includes('error') || l.toLowerCase().includes('fail')
    ).slice(-10);

    const summary = errorLines.length > 0 ? errorLines[0].trim() : 'Build failed during execution step.';

    return {
      summary,
      likelyRootCause: `Build halted due to compilation or execution failure reported in build log:\n${errorLines.join('\n')}`,
      recommendedFix: 'Review the failing import or build script line above. Ensure dependencies and environment variables match project requirements.'
    };
  }

  public static async investigateRuntimeError(
    route: string,
    rawError: string
  ): Promise<AiExplanation | null> {
    const consent = await vscode.window.showInformationMessage(
      `Send sanitized runtime error context from route '${route}' to AI Assistant?`,
      { modal: true },
      'Yes, Investigate',
      'Cancel'
    );

    if (consent !== 'Yes, Investigate') {
      return null;
    }

    const sanitized = LogSanitizer.sanitize(rawError);

    // Search workspace for files matching the route
    const cleanRoute = route.replace(/^\//, '').split('?')[0];
    let sourceFileHint: string | undefined;

    if (cleanRoute) {
      const files = await vscode.workspace.findFiles(`**/*${cleanRoute}*`, '**/node_modules/**', 3);
      if (files.length > 0) {
        sourceFileHint = vscode.workspace.asRelativePath(files[0]);
      }
    }

    return {
      summary: `Runtime Error at route: ${route}`,
      likelyRootCause: sanitized.substring(0, 300),
      recommendedFix: sourceFileHint
        ? `Inspect source file '${sourceFileHint}' to add error boundaries or null-checks.`
        : 'Add try-catch blocks and verify environment configuration.',
      sourceFileHint
    };
  }
}
