import * as https from 'node:https';
import {
  VercelApiError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitExceededError
} from './errors';
import { MemoryCache } from './cache';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  cacheTtlSeconds?: number;
  skipCache?: boolean;
}

export class BaseApiClient {
  private cache = new MemoryCache();
  private inFlightQueue = 0;
  private maxConcurrent = 5;
  private queueWaiters: Array<() => void> = [];

  constructor(
    private getAccessToken: () => Promise<string | undefined>,
    private getTeamId: () => string | undefined,
    private baseUrl = 'https://api.vercel.com'
  ) { }

  private async acquireSlot(): Promise<void> {
    if (this.inFlightQueue < this.maxConcurrent) {
      this.inFlightQueue++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queueWaiters.push(resolve);
    });
    this.inFlightQueue++;
  }

  private releaseSlot(): void {
    this.inFlightQueue--;
    const next = this.queueWaiters.shift();
    if (next) {
      next();
    }
  }

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new AuthenticationError();
    }

    const teamId = this.getTeamId();
    const query = { ...(options.query || {}) };
    if (teamId && !query.teamId) {
      query.teamId = teamId;
    }

    const queryString = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');

    const fullPath = `${path}${queryString ? `?${queryString}` : ''}`;
    const cacheKey = `${options.method || 'GET'}:${fullPath}:${teamId || 'personal'}`;

    if ((!options.method || options.method === 'GET') && !options.skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached && !cached.isStale) {
        return cached.data;
      }
    }

    await this.acquireSlot();

    try {
      return await this.executeWithRetry<T>(fullPath, options, token, cacheKey);
    } finally {
      this.releaseSlot();
    }
  }

  private async executeWithRetry<T>(
    fullPath: string,
    options: RequestOptions,
    token: string,
    cacheKey: string,
    attempts = 0
  ): Promise<T> {
    try {
      const result = await this.rawRequest<T>(fullPath, options, token);
      if ((!options.method || options.method === 'GET') && options.cacheTtlSeconds) {
        this.cache.set(cacheKey, result, options.cacheTtlSeconds);
      }
      return result;
    } catch (err: unknown) {
      if (err instanceof RateLimitExceededError && attempts < 2) {
        await new Promise((resolve) => setTimeout(resolve, (err.retryAfterSeconds || 2) * 1000));
        return this.executeWithRetry<T>(fullPath, options, token, cacheKey, attempts + 1);
      }

      if (err instanceof VercelApiError && (err.statusCode === 500 || err.statusCode === 503) && attempts < 2) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        return this.executeWithRetry<T>(fullPath, options, token, cacheKey, attempts + 1);
      }

      throw err;
    }
  }

  private rawRequest<T>(fullPath: string, options: RequestOptions, token: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${fullPath}`);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Vercel-Control-Center-VSCode/1.0.0',
        Accept: 'application/json',
        ...(options.headers || {})
      };

      let bodyData: string | undefined;
      if (options.body) {
        bodyData = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(bodyData).toString();
      }

      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method: options.method || 'GET',
          headers
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            const statusCode = res.statusCode || 500;
            if (statusCode === 401) {
              return reject(new AuthenticationError());
            }
            if (statusCode === 403) {
              return reject(new PermissionDeniedError());
            }
            if (statusCode === 404) {
              return reject(new NotFoundError(url.pathname));
            }
            if (statusCode === 429) {
              const retryAfter = parseInt(res.headers['retry-after'] as string, 10) || 60;
              return reject(new RateLimitExceededError(retryAfter));
            }

            if (statusCode >= 400) {
              let errorMsg = `Vercel API error (${statusCode})`;
              let errorCode: string | undefined;
              try {
                const parsed = JSON.parse(data);
                if (parsed.error?.message) {
                  errorMsg = parsed.error.message;
                  errorCode = parsed.error.code;
                } else if (parsed.message) {
                  errorMsg = parsed.message;
                }
              } catch {
                // Ignore JSON parse error on error body
              }
              return reject(new VercelApiError(statusCode, errorMsg, errorCode));
            }

            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed as T);
            } catch (e) {
              reject(new VercelApiError(500, `Failed to parse response JSON: ${(e as Error).message}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new VercelApiError(500, `Network error: ${err.message}`));
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }

  public invalidateCache(prefix = ''): void {
    if (prefix) {
      this.cache.invalidatePattern(prefix);
    } else {
      this.cache.clear();
    }
  }
}
