import { VercelTeam } from '../types/vercel';

export class PermissionGuard {
  public static canDeploy(team?: VercelTeam): boolean {
    if (!team || !team.membership) return true; // Personal account
    const role = team.membership.role.toUpperCase();
    return role === 'OWNER' || role === 'MEMBER' || role === 'DEVELOPER';
  }

  public static canManageEnv(team?: VercelTeam): boolean {
    if (!team || !team.membership) return true;
    const role = team.membership.role.toUpperCase();
    return role === 'OWNER' || role === 'MEMBER';
  }

  public static canManageDomains(team?: VercelTeam): boolean {
    if (!team || !team.membership) return true;
    const role = team.membership.role.toUpperCase();
    return role === 'OWNER' || role === 'MEMBER';
  }

  public static canRollback(team?: VercelTeam): boolean {
    if (!team || !team.membership) return true;
    const role = team.membership.role.toUpperCase();
    return role === 'OWNER' || role === 'MEMBER';
  }
}
