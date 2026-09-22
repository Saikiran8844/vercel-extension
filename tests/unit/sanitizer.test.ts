import { describe, it, expect } from 'vitest';
import { LogSanitizer } from '../../src/ai/logSanitizer';

describe('LogSanitizer', () => {
  it('redacts Authorization bearer tokens', () => {
    const raw = 'Request header: Authorization: Bearer vercel_pat_12345abcdef';
    const sanitized = LogSanitizer.sanitize(raw);
    expect(sanitized).toBe('Request header: Authorization: Bearer [REDACTED_TOKEN]');
  });

  it('redacts database connection strings', () => {
    const raw = 'Connecting to postgres://admin:superSecret123@db.supabase.co:5432/main';
    const sanitized = LogSanitizer.sanitize(raw);
    expect(sanitized).toContain('postgres://[USER]:[REDACTED]@db.supabase.co:5432/main');
  });

  it('redacts API key definitions in logs', () => {
    const raw = 'Error with API_KEY="sk-abcdef1234567890"';
    const sanitized = LogSanitizer.sanitize(raw);
    expect(sanitized).toBe('Error with API_KEY=[REDACTED]');
  });
});
