import * as vscode from 'vscode';
import { VercelBuildEvent, VercelRuntimeLog } from '../types/vercel';

export class LogViewer {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Vercel Logs');
  }

  public show(): void {
    this.outputChannel.show(true);
  }

  public clear(): void {
    this.outputChannel.clear();
  }

  public renderBuildEvents(events: VercelBuildEvent[], deploymentUrl?: string): void {
    this.clear();
    this.outputChannel.appendLine(`=======================================================`);
    this.outputChannel.appendLine(` Vercel Build Logs: ${deploymentUrl || 'Deployment'}`);
    this.outputChannel.appendLine(` Timestamp: ${new Date().toISOString()}`);
    this.outputChannel.appendLine(`=======================================================\n`);

    if (events.length === 0) {
      this.outputChannel.appendLine('No build events recorded.');
    }

    for (const ev of events) {
      const time = new Date(ev.created).toLocaleTimeString();
      const text = ev.payload?.text || '';
      if (text) {
        this.outputChannel.appendLine(`[${time}] ${text.trimEnd()}`);
      }
    }

    this.show();
  }

  public renderRuntimeLogs(logs: VercelRuntimeLog[], deploymentId?: string): void {
    this.clear();
    this.outputChannel.appendLine(`=======================================================`);
    this.outputChannel.appendLine(` Vercel Runtime Logs: ${deploymentId || 'Deployment'}`);
    this.outputChannel.appendLine(` Timestamp: ${new Date().toISOString()}`);
    this.outputChannel.appendLine(`=======================================================\n`);

    if (logs.length === 0) {
      this.outputChannel.appendLine('No runtime logs found for this deployment.');
    }

    for (const log of logs) {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const level = (log.level || 'info').toUpperCase().padEnd(5);
      const route = log.path ? ` [${log.path}]` : '';
      const status = log.statusCode ? ` ${log.statusCode}` : '';
      this.outputChannel.appendLine(`[${time}] [${level}]${status}${route} ${log.message}`);
    }

    this.show();
  }

  public append(text: string): void {
    this.outputChannel.appendLine(text);
  }

  public appendLine(text: string): void {
    this.outputChannel.appendLine(text);
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
