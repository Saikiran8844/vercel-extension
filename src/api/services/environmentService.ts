import { BaseApiClient } from '../client';
import { VercelEnvVariable } from '../../types/vercel';

export class EnvironmentService {
  constructor(private client: BaseApiClient) {}

  public async listEnvironmentVariables(projectId: string): Promise<VercelEnvVariable[]> {
    const res = await this.client.request<{ envs: VercelEnvVariable[] }>(
      `/v9/projects/${encodeURIComponent(projectId)}/env`,
      {
        cacheTtlSeconds: 30
      }
    );
    return res.envs || [];
  }

  public async createEnvironmentVariable(
    projectId: string,
    variable: {
      key: string;
      value: string;
      type: 'plain' | 'secret' | 'encrypted' | 'sensitive';
      target: Array<'production' | 'preview' | 'development'>;
      gitBranch?: string;
    }
  ): Promise<VercelEnvVariable> {
    const res = await this.client.request<VercelEnvVariable>(
      `/v10/projects/${encodeURIComponent(projectId)}/env`,
      {
        method: 'POST',
        body: variable
      }
    );
    this.client.invalidateCache(`/v9/projects/${projectId}/env`);
    return res;
  }

  public async deleteEnvironmentVariable(projectId: string, envId: string): Promise<void> {
    await this.client.request(
      `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
      {
        method: 'DELETE'
      }
    );
    this.client.invalidateCache(`/v9/projects/${projectId}/env`);
  }
}
