import { useState, useCallback } from 'react';
import type { CallerIdentity, InvocationResult, InvokeOptions } from '@capability-bus/core';
import { useBusContext } from './context.js';

export interface UseCapabilityReturn<T = unknown> {
  invoke: (args: unknown, options?: InvokeOptions) => Promise<InvocationResult<T>>;
  isLoading: boolean;
  result: InvocationResult<T> | null;
  error: InvocationResult<T> | null;
  reset: () => void;
}

export function useCapability<T = unknown>(
  capabilityName: string,
  callerSource?: string,
): UseCapabilityReturn<T> {
  const bus = useBusContext();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InvocationResult<T> | null>(null);
  const [error, setError] = useState<InvocationResult<T> | null>(null);

  const caller: CallerIdentity = {
    type: 'ui',
    source: callerSource ?? capabilityName,
  };

  const invoke = useCallback(
    async (args: unknown, options?: InvokeOptions): Promise<InvocationResult<T>> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await bus.invoke<T>(capabilityName, args, caller, options);
        setResult(res);
        if (res.status === 'error') {
          setError(res);
        }
        return res;
      } finally {
        setIsLoading(false);
      }
    },
    [bus, capabilityName, caller.source],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { invoke, isLoading, result, error, reset };
}
