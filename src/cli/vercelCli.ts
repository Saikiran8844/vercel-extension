import { spawn } from 'child_process';
import { DryRunParser } from './dryRunParser';
import { DryRunResult } from '../types/extension';

export interface CliExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class VercelCliRunner {
  public static async execute(
    args: string[],
    cwd: string,
    token?: string,
    onData?: (data: string) => void
  ): Promise<CliExecutionResult> {
    return new Promise((resolve) => {
      const finalArgs = [...args];
      if (token && !finalArgs.includes('--token') && !finalArgs.includes('-t')) {
        finalArgs.push('--token', token);
      }

      const proc = spawn('vercel', finalArgs, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          CI: '1'
        }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        if (onData) onData(str);
      });

      proc.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        if (onData) onData(str);
      });

      proc.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      proc.on('error', (err) => {
        resolve({
          stdout,
          stderr: `${stderr}\n${err.message}`,
          exitCode: 1
        });
      });
    });
  }

  public static async runDryRun(cwd: string, token?: string): Promise<DryRunResult> {
    const res = await this.execute(['deploy', '--dry', '--yes'], cwd, token);
    return DryRunParser.parse(res.stdout + '\n' + res.stderr);
  }

  public static async pullEnv(cwd: string, environment: 'development' | 'preview' | 'production', token?: string): Promise<CliExecutionResult> {
    return await this.execute(['env', 'pull', `.env.${environment}.local`, '--environment', environment, '--yes'], cwd, token);
  }

  public static async linkProject(cwd: string, token?: string): Promise<CliExecutionResult> {
    return await this.execute(['link', '--yes'], cwd, token);
  }
}
