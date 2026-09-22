import { BaseApiClient } from '../client';
import { VercelBuildEvent, VercelRuntimeLog } from '../../types/vercel';

export class LogService {
  constructor(private client: BaseApiClient) {}

  public async getBuildEvents(deploymentIdOrUrl: string, limit = 100): Promise<VercelBuildEvent[]> {
    const res = await this.client.request<VercelBuildEvent[]>(
      `/v3/deployments/${encodeURIComponent(deploymentIdOrUrl)}/events`,
      {
        query: { limit },
        cacheTtlSeconds: 5
      }
    );
    return Array.isArray(res) ? res : [];
  }

  public async getRuntimeLogs(
    projectId: string,
    deploymentId: string,
    limit = 50
  ): Promise<VercelRuntimeLog[]> {
    const res = await this.client.request<VercelRuntimeLog[]>(
      `/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs`,
      {
        query: { limit },
        cacheTtlSeconds: 5
      }
    );
    return Array.isArray(res) ? res : [];
  }
}
