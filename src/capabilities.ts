export type SupportLevel = 'FULL' | 'PARTIAL' | 'DASHBOARD' | 'UNSUPPORTED';

export interface FeatureCapability {
  name: string;
  category: string;
  supportLevel: SupportLevel;
  apiSupported: boolean;
  cliSupported: boolean;
  dashboardFallbackUrl?: string;
  notes?: string;
}

export class CapabilityRegistry {
  private static readonly capabilities: Record<string, FeatureCapability> = {
    deployments: {
      name: 'Deployments',
      category: 'Deployment',
      supportLevel: 'FULL',
      apiSupported: true,
      cliSupported: true,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]/deployments',
      notes: 'Full list, inspect, cancel, rollback, promote via REST API and CLI.'
    },
    projects: {
      name: 'Projects',
      category: 'Projects',
      supportLevel: 'FULL',
      apiSupported: true,
      cliSupported: true,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]',
      notes: 'Global and workspace-linked project management.'
    },
    environmentVariables: {
      name: 'Environment Variables',
      category: 'Configuration',
      supportLevel: 'FULL',
      apiSupported: true,
      cliSupported: true,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]/settings/environment-variables',
      notes: 'Production, Preview, and Development env vars with secret masking.'
    },
    domains: {
      name: 'Domains & DNS',
      category: 'Networking',
      supportLevel: 'FULL',
      apiSupported: true,
      cliSupported: true,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]/settings/domains',
      notes: 'Custom domains, SSL certificates, DNS records, and verification.'
    },
    logs: {
      name: 'Build & Runtime Logs',
      category: 'Observability',
      supportLevel: 'FULL',
      apiSupported: true,
      cliSupported: true,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]/logs',
      notes: 'Real-time build event streaming and serverless runtime logs.'
    },
    firewall: {
      name: 'Firewall & WAF',
      category: 'Security',
      supportLevel: 'PARTIAL',
      apiSupported: true,
      cliSupported: false,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]/security',
      notes: 'Managed rules, custom IP bypass, and attack challenge status.'
    },
    observability: {
      name: 'Observability & Metrics',
      category: 'Observability',
      supportLevel: 'PARTIAL',
      apiSupported: true,
      cliSupported: false,
      dashboardFallbackUrl: 'https://vercel.com/[team]/[project]/analytics',
      notes: 'Metrics cards and Core Web Vitals summaries with dashboard deep links.'
    },
    blob: {
      name: 'Vercel Blob',
      category: 'Storage',
      supportLevel: 'PARTIAL',
      apiSupported: true,
      cliSupported: true,
      dashboardFallbackUrl: 'https://vercel.com/[team]/~/stores/blob',
      notes: 'Store listing and file exploration via CLI and REST API.'
    },
    queues: {
      name: 'Vercel Queues',
      category: 'Compute',
      supportLevel: 'PARTIAL',
      apiSupported: true,
      cliSupported: false,
      dashboardFallbackUrl: 'https://vercel.com/[team]/~/queues',
      notes: 'Queue status and consumer metadata.'
    },
    aiGateway: {
      name: 'AI Gateway',
      category: 'AI',
      supportLevel: 'PARTIAL',
      apiSupported: true,
      cliSupported: false,
      dashboardFallbackUrl: 'https://vercel.com/[team]/~/ai-gateway',
      notes: 'Gateway routing status and model configuration link.'
    },
    workflow: {
      name: 'Vercel Workflow',
      category: 'Workflows',
      supportLevel: 'DASHBOARD',
      apiSupported: false,
      cliSupported: false,
      dashboardFallbackUrl: 'https://vercel.com/docs/workflow',
      notes: 'Workflow definitions and event-sourced runtime documentation.'
    },
    sandbox: {
      name: 'Vercel Sandbox',
      category: 'Compute',
      supportLevel: 'DASHBOARD',
      apiSupported: false,
      cliSupported: false,
      dashboardFallbackUrl: 'https://vercel.com/docs/sandbox',
      notes: 'MicroVM container sandbox management via web console.'
    }
  };

  public static get(featureKey: string): FeatureCapability | undefined {
    return this.capabilities[featureKey];
  }

  public static getAll(): FeatureCapability[] {
    return Object.values(this.capabilities);
  }

  public static getDashboardUrl(featureKey: string, teamSlug = 'account', projectSlug = 'project'): string {
    const cap = this.capabilities[featureKey];
    if (!cap || !cap.dashboardFallbackUrl) {
      return `https://vercel.com/${teamSlug}/${projectSlug}`;
    }
    return cap.dashboardFallbackUrl.replace('[team]', teamSlug).replace('[project]', projectSlug);
  }
}
