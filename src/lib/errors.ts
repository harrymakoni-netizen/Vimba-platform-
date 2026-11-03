export type ErrorCode = 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'rate_limited';

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation: 422,
  rate_limited: 429,
};

/** Safe, user-presentable error. Messages must never reveal another newsroom's records. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export const notFound = () => new AppError('not_found', 'Not found');
export const forbidden = (msg = 'You do not have permission to do that') => new AppError('forbidden', msg);
export const conflict = (msg: string, details?: Record<string, unknown>) => new AppError('conflict', msg, details);
export const invalid = (msg: string, details?: Record<string, unknown>) => new AppError('validation', msg, details);

/** Logs a safe line: error codes and request IDs, never bodies, phone numbers or tokens. */
export function logError(requestId: string, err: unknown, context: Record<string, string | number | boolean> = {}) {
  const code = err instanceof AppError ? err.code : 'internal';
  const pgCode = (err as { code?: string })?.code;
  console.error(JSON.stringify({ level: 'error', requestId, code, pgCode, ...context }));
}
