import { describe, it, expect } from 'vitest';
import { BuildDiagnosticRules } from '../../src/diagnostics/rules/buildRules';
import { EnvDiagnosticRules } from '../../src/diagnostics/rules/envRules';
import { DnsDiagnosticRules } from '../../src/diagnostics/rules/dnsRules';
import { VercelDomain, VercelEnvVariable } from '../../src/types/vercel';

describe('Diagnostics Engine Rules', () => {
  it('detects missing dependencies in build logs', () => {
    const log = `
      > next build
      Module not found: Can't resolve 'canvas-confetti' in '/app/page.tsx'
      Build failed.
    `;
    const results = BuildDiagnosticRules.analyze(log);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('BUILD');
    expect(results[0].problem).toContain('canvas-confetti');
    expect(results[0].suggestedFix).toContain('npm install canvas-confetti');
  });

  it('detects missing environment variables in build logs', () => {
    const log = 'Error: process.env.STRIPE_SECRET_KEY is undefined';
    const envs: VercelEnvVariable[] = [
      {
        id: '1',
        key: 'DATABASE_URL',
        type: 'encrypted',
        target: ['production', 'preview', 'development']
      }
    ];

    const results = EnvDiagnosticRules.analyze(log, envs, 'production');
    expect(results.length).toBe(1);
    expect(results[0].problem).toContain('STRIPE_SECRET_KEY');
    expect(results[0].category).toBe('ENVIRONMENT');
  });

  it('detects unverified domains and suggests DNS record fixes', () => {
    const domains: VercelDomain[] = [
      {
        name: 'app.example.com',
        apexName: 'example.com',
        projectId: 'proj_123',
        verified: false
      }
    ];

    const results = DnsDiagnosticRules.analyze(domains);
    expect(results.length).toBe(1);
    expect(results[0].problem).toContain('app.example.com');
    expect(results[0].suggestedFix).toContain('cname.vercel-dns.com');
  });
});
