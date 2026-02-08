import type { Middleware } from './types.js';

export function createLoggingMiddleware(logger: Pick<Console, 'log'> = console): Middleware {
  return async (invocation, capability, next) => {
    logger.log(`[bus] invoking ${invocation.capability}`, invocation.arguments);
    const result = await next();
    logger.log(`[bus] ${invocation.capability} → ${result.status}`);
    return result;
  };
}

export function createTimingMiddleware(
  onTiming?: (capability: string, durationMs: number) => void,
): Middleware {
  return async (invocation, _capability, next) => {
    const start = performance.now();
    const result = await next();
    const duration = performance.now() - start;
    onTiming?.(invocation.capability, duration);
    return result;
  };
}

export function createConfirmationMiddleware(
  confirm: (description: string, args: unknown) => Promise<boolean>,
): Middleware {
  return async (invocation, capability, next) => {
    if (
      capability.sideEffect === 'destructive' &&
      invocation.caller.type === 'agent'
    ) {
      const confirmed = await confirm(capability.description, invocation.arguments);
      if (!confirmed) {
        return {
          status: 'error',
          requestId: invocation.requestId,
          code: 'FORBIDDEN',
          message: 'User declined the action',
          timestamp: Date.now(),
        };
      }
    }
    return next();
  };
}
