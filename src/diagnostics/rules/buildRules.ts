import { DiagnosticItem } from '../../types/extension';

export class BuildDiagnosticRules {
  public static analyze(logs: string): DiagnosticItem[] {
    const items: DiagnosticItem[] = [];

    // 1. Missing module / package
    if (logs.includes('Cannot find module') || logs.includes('Module not found')) {
      const match = logs.match(/(?:Cannot find module|Module not found: Can't resolve) '([^']+)'/);
      const pkg = match ? match[1] : 'dependency';
      items.push({
        id: 'build-missing-module',
        category: 'BUILD',
        severity: 'ERROR',
        problem: `Missing dependency: ${pkg}`,
        evidence: match ? match[0] : 'Module not found in build logs',
        likelyCause: `Package '${pkg}' is imported in code but not installed in dependencies or listed in package.json.`,
        suggestedFix: `Run 'npm install ${pkg}' and ensure it is saved under dependencies.`,
        codeActionAvailable: true
      });
    }

    // 2. Node version mismatch
    if (logs.includes('The engine "node" is incompatible') || logs.includes('Node.js version mismatch')) {
      items.push({
        id: 'build-node-version',
        category: 'BUILD',
        severity: 'WARNING',
        problem: 'Incompatible Node.js Engine',
        evidence: 'Engine "node" is incompatible with package.json requirements',
        likelyCause: 'Project package.json engine constraint does not match Vercel Node runtime setting.',
        suggestedFix: 'Configure Project Settings > Node.js Version in Vercel to match package.json engine requirements.'
      });
    }

    // 3. Next.js export error with dynamic server components
    if (logs.includes('Dynamic server usage: Page couldn\'t be rendered statically')) {
      items.push({
        id: 'build-dynamic-usage',
        category: 'BUILD',
        severity: 'ERROR',
        problem: 'Static Render Error with Dynamic Usage',
        evidence: 'Dynamic server usage detected on statically generated page',
        likelyCause: 'headers(), cookies(), or searchParams used without export const dynamic = "force-dynamic".',
        suggestedFix: 'Add \'export const dynamic = "force-dynamic"\' to the offending page or route handler.'
      });
    }

    // 4. Memory or timeout error
    if (logs.includes('JavaScript heap out of memory') || logs.includes('Build exceeded maximum duration')) {
      items.push({
        id: 'build-resource-limit',
        category: 'BUILD',
        severity: 'CRITICAL',
        problem: 'Build Resource Limit Exceeded',
        evidence: 'Heap out of memory or build duration limit reached',
        likelyCause: 'Compilation consumes excessive RAM or hangs on remote resource fetches.',
        suggestedFix: 'Optimize build step or set NODE_OPTIONS="--max-old-space-size=4096" in Build Environment Variables.'
      });
    }

    return items;
  }
}
