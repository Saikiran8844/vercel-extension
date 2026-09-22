import { BaseApiClient } from '../client';
import { VercelDeployment } from '../../types/vercel';

export class DeploymentService {
  constructor(private client: BaseApiClient) {}

  public async listDeployments(projectId?: string, limit = 30): Promise<VercelDeployment[]> {
    const res = await this.client.request<{ deployments: VercelDeployment[] }>('/v6/deployments', {
      query: { projectId, limit },
      cacheTtlSeconds: 15
    });
    return res.deployments || [];
  }

  public async getDeployment(idOrUrl: string): Promise<VercelDeployment> {
    return await this.client.request<VercelDeployment>(`/v13/deployments/${encodeURIComponent(idOrUrl)}`, {
      cacheTtlSeconds: 10
    });
  }

  public async cancelDeployment(deploymentId: string): Promise<VercelDeployment> {
    const res = await this.client.request<VercelDeployment>(
      `/v12/deployments/${encodeURIComponent(deploymentId)}/cancel`,
      {
        method: 'PATCH'
      }
    );
    this.client.invalidateCache('/v6/deployments');
    return res;
  }

  public async rollback(projectId: string, deploymentId: string): Promise<{ status: string }> {
    const res = await this.client.request<{ status: string }>(
      `/v9/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(deploymentId)}`,
      {
        method: 'POST'
      }
    );
    this.client.invalidateCache('/v6/deployments');
    return res;
  }

  public async listFiles(deploymentId: string): Promise<Array<{ name: string; type: string; mode: number }>> {
    return await this.client.request<Array<{ name: string; type: string; mode: number }>>(
      `/v6/deployments/${encodeURIComponent(deploymentId)}/files`,
      {
        cacheTtlSeconds: 60
      }
    );
  }
}
