import { BaseApiClient } from '../client';
import { VercelProject } from '../../types/vercel';

export class ProjectService {
  constructor(private client: BaseApiClient) {}

  public async listProjects(limit = 50): Promise<VercelProject[]> {
    const res = await this.client.request<{ projects: VercelProject[] }>('/v9/projects', {
      query: { limit },
      cacheTtlSeconds: 60
    });
    return res.projects || [];
  }

  public async getProject(idOrName: string): Promise<VercelProject> {
    return await this.client.request<VercelProject>(`/v9/projects/${encodeURIComponent(idOrName)}`, {
      cacheTtlSeconds: 30
    });
  }

  public async updateProjectSettings(
    idOrName: string,
    settings: {
      buildCommand?: string | null;
      outputDirectory?: string | null;
      installCommand?: string | null;
      framework?: string | null;
      nodeVersion?: string | null;
    }
  ): Promise<VercelProject> {
    const res = await this.client.request<VercelProject>(`/v10/projects/${encodeURIComponent(idOrName)}`, {
      method: 'PATCH',
      body: settings
    });
    this.client.invalidateCache('/v9/projects');
    return res;
  }

  public async createProject(params: {
    name: string;
    framework?: string | null | undefined;
    gitRepository?: {
      type: string;
      repo: string;
    } | undefined;
    rootDirectory?: string | null | undefined;
  }): Promise<VercelProject> {
    const res = await this.client.request<VercelProject>('/v9/projects', {
      method: 'POST',
      body: params
    });
    this.client.invalidateCache('/v9/projects');
    return res;
  }
}
