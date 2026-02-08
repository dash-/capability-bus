import type { ErrorCode, ErrorResult } from './types.js';

export function createErrorResult(
  requestId: string,
  code: ErrorCode,
  message: string,
  recoveryHint?: string,
): ErrorResult {
  return {
    status: 'error',
    requestId,
    code,
    message,
    ...(recoveryHint !== undefined && { recoveryHint }),
    timestamp: Date.now(),
  };
}
