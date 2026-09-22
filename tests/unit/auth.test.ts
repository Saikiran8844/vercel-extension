import { describe, it, expect } from 'vitest';
import { TokenManager } from '../../src/auth/tokenManager';

describe('TokenManager', () => {
  it('masks sensitive access tokens properly', () => {
    expect(TokenManager.maskToken(undefined)).toBe('None');
    expect(TokenManager.maskToken('')).toBe('None');
    expect(TokenManager.maskToken('short')).toBe('••••••••');
    expect(TokenManager.maskToken('abcdef1234567890xyz')).toBe('abcd••••••••0xyz');
  });
});
