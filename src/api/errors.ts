export class VercelApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'VercelApiError';
  }
}

export class AuthenticationError extends VercelApiError {
  constructor(message = 'Authentication required. Please log in with a valid Vercel Personal Access Token.') {
    super(401, message, 'unauthorized');
    this.name = 'AuthenticationError';
  }
}

export class PermissionDeniedError extends VercelApiError {
  constructor(message = 'You are authenticated but do not have permission for this operation on this team/project.') {
    super(403, message, 'forbidden');
    this.name = 'PermissionDeniedError';
  }
}

export class NotFoundError extends VercelApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found on Vercel.`, 'not_found');
    this.name = 'NotFoundError';
  }
}

export class RateLimitExceededError extends VercelApiError {
  constructor(public readonly retryAfterSeconds = 60) {
    super(
      429,
      `Vercel API rate limit exceeded. Retry available in ${retryAfterSeconds} seconds.`,
      'rate_limited',
      { retryAfter: retryAfterSeconds }
    );
    this.name = 'RateLimitExceededError';
  }
}
