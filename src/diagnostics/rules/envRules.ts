import { DiagnosticItem } from '../../types/extension';
import { VercelEnvVariable } from '../../types/vercel';

export class EnvDiagnosticRules {
  public static analyze(
    logs: string,
    existingEnvs: VercelEnvVariable[],
    targetEnv: 'production' | 'preview' | 'development'
  ): DiagnosticItem[] {
    const items: DiagnosticItem[] = [];

    // Check for common missing env message
    const envMatch = logs.match(/process\.env\.([A-Z0-9_]+) is undefined|missing environment variable:?\s*([A-Z0-9_]+)/i);
    if (envMatch) {
      const varName = envMatch[1] || envMatch[2];
      const existsInTarget = existingEnvs.some(
        (e) => e.key === varName && e.target.includes(targetEnv)
      );

      if (!existsInTarget) {
        items.push({
          id: `missing-env-${varName}`,
          category: 'ENVIRONMENT',
          severity: 'CRITICAL',
          problem: `Missing Environment Variable: ${varName}`,
          evidence: `Build log references undefined ${varName}`,
          likelyCause: `Variable '${varName}' is expected during build/runtime but is not configured for '${targetEnv}'.`,
          suggestedFix: `Add '${varName}' to ${targetEnv} environment variables in Vercel Control Center.`,
          codeActionAvailable: true
        });
      }
    }

    return items;
  }
}
