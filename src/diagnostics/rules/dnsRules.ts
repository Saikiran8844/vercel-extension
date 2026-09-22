import { DiagnosticItem } from '../../types/extension';
import { VercelDomain } from '../../types/vercel';

export class DnsDiagnosticRules {
  public static analyze(domains: VercelDomain[]): DiagnosticItem[] {
    const items: DiagnosticItem[] = [];

    for (const domain of domains) {
      if (!domain.verified) {
        let suggestedFix = `Configure DNS CNAME record pointing to 'cname.vercel-dns.com'.`;
        if (domain.name === domain.apexName) {
          suggestedFix = `Configure DNS A record pointing to '76.76.21.21' at your DNS provider.`;
        }

        items.push({
          id: `dns-unverified-${domain.name}`,
          category: 'DNS',
          severity: 'WARNING',
          problem: `Domain Unverified: ${domain.name}`,
          evidence: `Domain '${domain.name}' has not completed DNS verification.`,
          likelyCause: 'DNS records (A or CNAME) have not propagated or are pointing to a different host.',
          suggestedFix,
          codeActionAvailable: true
        });
      }
    }

    return items;
  }
}
