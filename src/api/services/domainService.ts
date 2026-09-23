import { BaseApiClient } from '../client';
import { VercelDomain } from '../../types/vercel';

export class DomainService {
  constructor(private client: BaseApiClient) {}

  public async listDomains(projectId: string): Promise<VercelDomain[]> {
    const res = await this.client.request<{ domains: VercelDomain[] }>(
      `/v9/projects/${encodeURIComponent(projectId)}/domains`,
      {
        cacheTtlSeconds: 60
      }
    );
    return res.domains || [];
  }

  public async listAllAccountDomains(): Promise<VercelDomain[]> {
    try {
      const res = await this.client.request<{ domains?: VercelDomain[] } | VercelDomain[]>(
        '/v5/domains',
        {
          cacheTtlSeconds: 60
        }
      );
      if (Array.isArray(res)) {
        return res;
      }
      return (res as { domains?: VercelDomain[] })?.domains || [];
    } catch {
      return [];
    }
  }

  public async addDomain(
    projectId: string,
    domain: string,
    redirect?: string
  ): Promise<VercelDomain> {
    const res = await this.client.request<VercelDomain>(
      `/v9/projects/${encodeURIComponent(projectId)}/domains`,
      {
        method: 'POST',
        body: { name: domain, redirect }
      }
    );
    this.client.invalidateCache(`/v9/projects/${projectId}/domains`);
    return res;
  }

  public async removeDomain(projectId: string, domain: string): Promise<void> {
    await this.client.request(
      `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`,
      {
        method: 'DELETE'
      }
    );
    this.client.invalidateCache(`/v9/projects/${projectId}/domains`);
  }

  public async verifyDomain(projectId: string, domain: string): Promise<VercelDomain> {
    const res = await this.client.request<VercelDomain>(
      `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`,
      {
        method: 'POST'
      }
    );
    this.client.invalidateCache(`/v9/projects/${projectId}/domains`);
    return res;
  }
}
