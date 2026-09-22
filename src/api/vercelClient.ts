import { BaseApiClient } from './client';
import { AuthService } from './services/authService';
import { ProjectService } from './services/projectService';
import { DeploymentService } from './services/deploymentService';
import { EnvironmentService } from './services/environmentService';
import { DomainService } from './services/domainService';
import { LogService } from './services/logService';
import { SecurityService } from './services/securityService';
import { PlatformServices } from './services/platformServices';

export class VercelClient {
  private baseClient: BaseApiClient;

  public readonly auth: AuthService;
  public readonly projects: ProjectService;
  public readonly deployments: DeploymentService;
  public readonly environments: EnvironmentService;
  public readonly domains: DomainService;
  public readonly logs: LogService;
  public readonly security: SecurityService;
  public readonly platform: PlatformServices;

  constructor(
    getAccessToken: () => Promise<string | undefined>,
    getTeamId: () => string | undefined,
    baseUrl?: string
  ) {
    this.baseClient = new BaseApiClient(getAccessToken, getTeamId, baseUrl);
    this.auth = new AuthService(this.baseClient);
    this.projects = new ProjectService(this.baseClient);
    this.deployments = new DeploymentService(this.baseClient);
    this.environments = new EnvironmentService(this.baseClient);
    this.domains = new DomainService(this.baseClient);
    this.logs = new LogService(this.baseClient);
    this.security = new SecurityService(this.baseClient);
    this.platform = new PlatformServices(this.baseClient);
  }

  public invalidateAllCache(): void {
    this.baseClient.invalidateCache();
  }
}
