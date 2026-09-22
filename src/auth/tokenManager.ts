import * as vscode from 'vscode';

export class TokenManager {
  private static readonly SECRET_KEY = 'vercel_access_token';
  private static readonly ACTIVE_TEAM_KEY = 'vercel_active_team_id';

  constructor(
    private secrets: vscode.SecretStorage,
    private globalState: vscode.Memento
  ) {}

  public async getAccessToken(): Promise<string | undefined> {
    return await this.secrets.get(TokenManager.SECRET_KEY);
  }

  public async setAccessToken(token: string): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new Error('Token cannot be empty');
    }
    await this.secrets.store(TokenManager.SECRET_KEY, trimmed);
  }

  public async deleteAccessToken(): Promise<void> {
    await this.secrets.delete(TokenManager.SECRET_KEY);
    await this.globalState.update(TokenManager.ACTIVE_TEAM_KEY, undefined);
  }

  public getActiveTeamId(): string | undefined {
    return this.globalState.get<string>(TokenManager.ACTIVE_TEAM_KEY);
  }

  public async setActiveTeamId(teamId: string | undefined): Promise<void> {
    await this.globalState.update(TokenManager.ACTIVE_TEAM_KEY, teamId);
  }

  public static maskToken(token?: string): string {
    if (!token) return 'None';
    if (token.length <= 8) return '••••••••';
    return `${token.substring(0, 4)}••••••••${token.substring(token.length - 4)}`;
  }
}
