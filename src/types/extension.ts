import * as vscode from 'vscode';
import { VercelProject, VercelDeployment, VercelEnvVariable, VercelDomain, VercelTeam } from './vercel';

export interface WorkspaceProjectConfig {
  projectId: string;
  orgId: string;
  projectName?: string | undefined;
  rootPath: string;
  framework?: string | undefined;
  isMonorepo?: boolean | undefined;
}

export type TreeItemContextValue =
  | 'project'
  | 'deployment'
  | 'envVariable'
  | 'domain'
  | 'team'
  | 'platformService'
  | 'category'
  | 'info'
  | 'action';

export interface VercelTreeItem extends vscode.TreeItem {
  contextValue: TreeItemContextValue;
  data?: VercelProject | VercelDeployment | VercelEnvVariable | VercelDomain | VercelTeam | Record<string, unknown>;
}

export type DiagnosticSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface DiagnosticItem {
  id: string;
  category: 'BUILD' | 'ENVIRONMENT' | 'FRAMEWORK' | 'DNS' | 'DRIFT' | 'RUNTIME';
  severity: DiagnosticSeverity;
  problem: string;
  evidence: string;
  likelyCause: string;
  suggestedFix: string;
  codeActionAvailable?: boolean;
}

export interface ConfigurationDrift {
  property: string;
  localValue: string | null;
  remoteValue: string | null;
  hasDrift: boolean;
  recommendation: string;
}

export interface DryRunResult {
  totalFiles: number;
  totalSize: number;
  framework: string | null;
  includedFiles: string[];
  ignoredFiles: string[];
  largeFiles: Array<{ path: string; size: number }>;
}
