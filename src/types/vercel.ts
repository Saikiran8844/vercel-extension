export interface VercelUser {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar?: string;
}

export interface VercelTeam {
  id: string;
  slug: string;
  name: string;
  creatorId: string;
  avatar?: string;
  membership?: {
    role: 'OWNER' | 'MEMBER' | 'VIEWER' | 'DEVELOPER' | 'BILLING' | string;
  };
}

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  framework?: string | null;
  updatedAt?: number;
  createdAt?: number;
  latestDeployments?: VercelDeployment[];
  targets?: {
    production?: {
      id?: string;
      url?: string;
      readyState?: string;
      meta?: Record<string, string>;
    };
  };
  link?: {
    type?: string;
    repo?: string;
    org?: string;
    productionBranch?: string;
  };
  buildCommand?: string | null;
  outputDirectory?: string | null;
  installCommand?: string | null;
  rootDirectory?: string | null;
  nodeVersion?: string | null;
}

export type DeploymentState = 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  state: DeploymentState;
  type?: string;
  creator?: {
    uid: string;
    email?: string;
    username?: string;
  };
  target?: 'production' | 'preview' | 'staging' | null;
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    githubCommitRef?: string;
    gitlabCommitSha?: string;
    bitbucketCommitSha?: string;
    branch?: string;
    [key: string]: string | undefined;
  };
  buildingAt?: number;
  ready?: number;
  duration?: number;
  inspectorUrl?: string;
}

export interface VercelEnvVariable {
  id: string;
  key: string;
  value?: string;
  type: 'plain' | 'secret' | 'encrypted' | 'sensitive';
  target: Array<'production' | 'preview' | 'development'>;
  gitBranch?: string;
  configurationId?: string | null;
  updatedAt?: number;
  createdAt?: number;
  decrypted?: boolean;
}

export interface VercelDomain {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason?: string;
  }>;
  nameservers?: string[];
  intendedNameservers?: string[];
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  updatedAt?: number;
  createdAt?: number;
}

export interface VercelBuildEvent {
  id: string;
  type: string;
  created: number;
  payload: {
    text?: string;
    type?: 'stdout' | 'stderr' | 'command';
    info?: {
      type?: string;
      name?: string;
      entrypoint?: string;
    };
    statusCode?: number;
  };
}

export interface VercelRuntimeLog {
  id: string;
  timestamp: number;
  message: string;
  level: 'info' | 'warn' | 'error' | 'fatal';
  requestId?: string;
  statusCode?: number;
  path?: string;
  host?: string;
  source?: string;
  proxy?: {
    timestamp: number;
    method: string;
    path: string;
    statusCode: number;
  };
}

export interface VercelFirewallConfig {
  version: number;
  rules?: Array<{
    id: string;
    name: string;
    action: 'deny' | 'challenge' | 'log' | 'bypass';
    active: boolean;
    conditionGroup?: Array<{
      conditions: Array<{
        type: string;
        op: string;
        value: string;
      }>;
    }>;
  }>;
  managedRules?: {
    sqli?: boolean;
    xss?: boolean;
    lfi?: boolean;
    rce?: boolean;
    scannerDetection?: boolean;
  };
  attackMode?: boolean;
}
