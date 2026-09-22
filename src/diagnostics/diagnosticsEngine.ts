import { DiagnosticItem } from '../types/extension';
import { BuildDiagnosticRules } from './rules/buildRules';
import { EnvDiagnosticRules } from './rules/envRules';
import { DnsDiagnosticRules } from './rules/dnsRules';
import { VercelEnvVariable, VercelDomain } from '../types/vercel';

export interface DiagnosticsContext {
  logs?: string;
  envs?: VercelEnvVariable[];
  targetEnv?: 'production' | 'preview' | 'development';
  domains?: VercelDomain[];
}

export class DiagnosticsEngine {
  public static runDiagnostics(context: DiagnosticsContext): DiagnosticItem[] {
    const results: DiagnosticItem[] = [];

    if (context.logs) {
      results.push(...BuildDiagnosticRules.analyze(context.logs));
    }

    if (context.logs && context.envs && context.targetEnv) {
      results.push(...EnvDiagnosticRules.analyze(context.logs, context.envs, context.targetEnv));
    }

    if (context.domains) {
      results.push(...DnsDiagnosticRules.analyze(context.domains));
    }

    return results;
  }
}
