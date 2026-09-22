import { BaseApiClient } from '../client';
import { VercelFirewallConfig } from '../../types/vercel';

export class SecurityService {
  constructor(private client: BaseApiClient) {}

  public async getFirewallConfig(projectId: string): Promise<VercelFirewallConfig> {
    return await this.client.request<VercelFirewallConfig>('/v1/security/firewall/config', {
      query: { projectId },
      cacheTtlSeconds: 60
    });
  }

  public async updateAttackMode(projectId: string, attackMode: boolean): Promise<VercelFirewallConfig> {
    const res = await this.client.request<VercelFirewallConfig>('/v1/security/firewall/config', {
      method: 'PATCH',
      query: { projectId },
      body: { attackMode }
    });
    this.client.invalidateCache('/v1/security/firewall/config');
    return res;
  }
}
