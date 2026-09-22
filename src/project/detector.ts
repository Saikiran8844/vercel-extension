import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceProjectConfig } from '../types/extension';
import { MonorepoDetector } from './monorepo';

export class ProjectDetector {
  public static detectFramework(rootPath: string): string | undefined {
    const pkgPath = path.join(rootPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return undefined;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (deps['next']) return 'nextjs';
      if (deps['@remix-run/react']) return 'remix';
      if (deps['astro']) return 'astro';
      if (deps['svelte'] || deps['@sveltejs/kit']) return 'sveltekit';
      if (deps['nuxt']) return 'nuxtjs';
      if (deps['vite']) return 'vite';
      if (deps['gatsby']) return 'gatsby';
      if (deps['vue']) return 'vue';
      if (deps['react-scripts']) return 'create-react-app';
    } catch {
      // Ignore
    }

    return undefined;
  }

  public static detectProject(workspaceRoot: string): WorkspaceProjectConfig | null {
    const projectJsonPath = path.join(workspaceRoot, '.vercel', 'project.json');

    if (fs.existsSync(projectJsonPath)) {
      try {
        const raw = fs.readFileSync(projectJsonPath, 'utf8');
        const data = JSON.parse(raw);
        if (data.projectId && data.orgId) {
          return {
            projectId: data.projectId,
            orgId: data.orgId,
            projectName: data.projectName,
            rootPath: workspaceRoot,
            framework: this.detectFramework(workspaceRoot),
            isMonorepo: MonorepoDetector.isMonorepo(workspaceRoot)
          };
        }
      } catch {
        // Return null on malformed json
      }
    }

    // Check monorepo packages for .vercel/project.json
    if (MonorepoDetector.isMonorepo(workspaceRoot)) {
      const packages = MonorepoDetector.findPackages(workspaceRoot);
      for (const pkg of packages) {
        if (pkg.hasProjectJson) {
          const subJson = path.join(pkg.absolutePath, '.vercel', 'project.json');
          try {
            const data = JSON.parse(fs.readFileSync(subJson, 'utf8'));
            if (data.projectId && data.orgId) {
              return {
                projectId: data.projectId,
                orgId: data.orgId,
                projectName: data.projectName || pkg.name,
                rootPath: pkg.absolutePath,
                framework: this.detectFramework(pkg.absolutePath),
                isMonorepo: true
              };
            }
          } catch {
            // Ignore
          }
        }
      }
    }

    return null;
  }
}
