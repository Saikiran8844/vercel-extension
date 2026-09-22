export class LogSanitizer {
  private static readonly PATTERNS: Array<[RegExp, string]> = [
    // Bearer / Token authorization
    [/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [REDACTED_TOKEN]'],
    // API keys / secrets in assignments
    [/(API_KEY|SECRET|PASSWORD|TOKEN|AUTH|CREDENTIALS)\s*[:=]\s*["']?[^"'\s,]+["']?/gi, '$1=[REDACTED]'],
    // Database connection URLs
    [/(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@/gi, '$1://[USER]:[REDACTED]@'],
    // JWT tokens
    [/ey[A-Za-z0-9-_]+\.ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '[REDACTED_JWT]'],
    // AWS keys
    [/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]']
  ];

  public static sanitize(text: string): string {
    let sanitized = text;
    for (const [regex, replacement] of this.PATTERNS) {
      sanitized = sanitized.replace(regex, replacement);
    }
    return sanitized;
  }
}
