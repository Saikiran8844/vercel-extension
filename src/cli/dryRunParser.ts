import { DryRunResult } from '../types/extension';

export class DryRunParser {
  public static parse(output: string): DryRunResult {
    const lines = output.split('\n');
    const includedFiles: string[] = [];
    const ignoredFiles: string[] = [];
    const largeFiles: Array<{ path: string; size: number }> = [];
    let framework: string | null = null;
    let totalSize = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.includes('Framework Detected:')) {
        const parts = line.split('Framework Detected:');
        if (parts[1]) framework = parts[1].trim();
      }

      // Check for file listings
      if (line.startsWith('+') || line.startsWith('Uploading') || line.includes('B ') || line.includes('kB ') || line.includes('MB ')) {
        const fileMatch = line.match(/([^\s]+)\s+([0-9.]+)\s*(B|kB|MB|GB)/i);
        if (fileMatch) {
          const filePath = fileMatch[1];
          const num = parseFloat(fileMatch[2]);
          const unit = fileMatch[3].toUpperCase();
          let bytes = num;
          if (unit === 'KB') bytes = num * 1024;
          if (unit === 'MB') bytes = num * 1024 * 1024;
          if (unit === 'GB') bytes = num * 1024 * 1024 * 1024;

          includedFiles.push(filePath);
          totalSize += bytes;

          if (bytes > 5 * 1024 * 1024) {
            largeFiles.push({ path: filePath, size: bytes });
          }
        }
      }

      if (line.includes('Ignored:') || line.startsWith('-')) {
        const parts = line.split(':');
        if (parts[1]) ignoredFiles.push(parts[1].trim());
      }
    }

    return {
      totalFiles: includedFiles.length,
      totalSize,
      framework,
      includedFiles,
      ignoredFiles,
      largeFiles
    };
  }
}
