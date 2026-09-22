import { describe, it, expect } from 'vitest';
import { DryRunParser } from '../../src/cli/dryRunParser';

describe('DryRunParser', () => {
  it('parses dry-run output and extracts included files and size', () => {
    const output = `
      Vercel CLI 48.10.2
      Framework Detected: Next.js
      + package.json 1.2 kB
      + app/page.tsx 4.5 kB
      + public/hero.png 6.2 MB
      - .env.local (Ignored)
    `;

    const result = DryRunParser.parse(output);
    expect(result.framework).toBe('Next.js');
    expect(result.includedFiles.length).toBe(3);
    expect(result.largeFiles.length).toBe(1);
    expect(result.largeFiles[0].path).toBe('public/hero.png');
    expect(result.totalSize).toBeGreaterThan(6 * 1024 * 1024);
  });
});
