import * as fs from 'fs';
import * as path from 'path';

export interface WorkspacePackage {
  name: string;
  relativePath: string;
  absolutePath: string;
  hasVercelConfig: boolean;
  hasProjectJson: boolean;
}

export class MonorepoDetector {
  public static isMonorepo(rootPath: string): boolean {
    const indicators = [
      'pnpm-workspace.yaml',
      'turbo.json',
      'lerna.json',
      'nx.json'
    ];

    for (const indicator of indicators) {
      if (fs.existsSync(path.join(rootPath, indicator))) {
        return true;
      }
    }

    const pkgJsonPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (pkg.workspaces) {
          return true;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    return false;
  }

  public static findPackages(rootPath: string): WorkspacePackage[] {
    const packages: WorkspacePackage[] = [];
    const searchDirs = ['apps', 'packages', 'services'];

    for (const dir of searchDirs) {
      const fullDir = path.join(rootPath, dir);
      if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
        const subdirs = fs.readdirSync(fullDir);
        for (const sub of subdirs) {
          const pkgPath = path.join(fullDir, sub);
          if (fs.statSync(pkgPath).isDirectory()) {
            const pkgJson = path.join(pkgPath, 'package.json');
            if (fs.existsSync(pkgJson)) {
              let name = `${dir}/${sub}`;
              try {
                const parsed = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
                if (parsed.name) name = parsed.name;
              } catch {
                // Ignore
              }

              packages.push({
                name,
                relativePath: path.join(dir, sub),
                absolutePath: pkgPath,
                hasVercelConfig: fs.existsSync(path.join(pkgPath, 'vercel.json')),
                hasProjectJson: fs.existsSync(path.join(pkgPath, '.vercel', 'project.json'))
              });
            }
          }
        }
      }
    }

    return packages;
  }
}
