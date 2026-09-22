import * as fs from 'fs';
import * as path from 'path';
import { VercelProject } from '../types/vercel';
import { ConfigurationDrift } from '../types/extension';

export class DriftDetector {
  public static detectDrift(projectRoot: string, remoteProject: VercelProject): ConfigurationDrift[] {
    const drifts: ConfigurationDrift[] = [];
    const vercelJsonPath = path.join(projectRoot, 'vercel.json');
    const pkgJsonPath = path.join(projectRoot, 'package.json');

    let localVercelConfig: Record<string, unknown> = {};
    if (fs.existsSync(vercelJsonPath)) {
      try {
        localVercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      } catch {
        // Ignore parse error
      }
    }

    let localPkg: Record<string, unknown> = {};
    if (fs.existsSync(pkgJsonPath)) {
      try {
        localPkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      } catch {
        // Ignore parse error
      }
    }

    // 1. Build Command
    const localBuildCmd = (localVercelConfig.buildCommand as string) || (localPkg.scripts as Record<string, string>)?.['build'] || null;
    const remoteBuildCmd = remoteProject.buildCommand || null;
    if (localBuildCmd && remoteBuildCmd && localBuildCmd !== remoteBuildCmd) {
      drifts.push({
        property: 'Build Command',
        localValue: localBuildCmd,
        remoteValue: remoteBuildCmd,
        hasDrift: true,
        recommendation: `Cloud build command is '${remoteBuildCmd}', but local command is '${localBuildCmd}'.`
      });
    }

    // 2. Framework
    const remoteFramework = remoteProject.framework || null;
    const localFramework = (localVercelConfig.framework as string) || null;
    if (localFramework && remoteFramework && localFramework !== remoteFramework) {
      drifts.push({
        property: 'Framework',
        localValue: localFramework,
        remoteValue: remoteFramework,
        hasDrift: true,
        recommendation: `Cloud framework is '${remoteFramework}', but local vercel.json specifies '${localFramework}'.`
      });
    }

    // 3. Output Directory
    const localOutput = (localVercelConfig.outputDirectory as string) || null;
    const remoteOutput = remoteProject.outputDirectory || null;
    if (localOutput && remoteOutput && localOutput !== remoteOutput) {
      drifts.push({
        property: 'Output Directory',
        localValue: localOutput,
        remoteValue: remoteOutput,
        hasDrift: true,
        recommendation: `Cloud output directory is '${remoteOutput}', but local specifies '${localOutput}'.`
      });
    }

    return drifts;
  }
}
