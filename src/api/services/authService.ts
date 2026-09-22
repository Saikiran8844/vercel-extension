import { BaseApiClient } from '../client';
import { VercelUser, VercelTeam } from '../../types/vercel';

export class AuthService {
  constructor(private client: BaseApiClient) {}

  public async getCurrentUser(): Promise<VercelUser> {
    const res = await this.client.request<{ user: VercelUser }>('/v2/user', {
      cacheTtlSeconds: 120
    });
    return res.user;
  }

  public async getTeams(): Promise<VercelTeam[]> {
    const res = await this.client.request<{ teams: VercelTeam[] }>('/v2/teams', {
      cacheTtlSeconds: 120
    });
    return res.teams || [];
  }
}
