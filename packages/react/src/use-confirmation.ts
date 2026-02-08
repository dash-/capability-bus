import { useState, useCallback, useRef } from 'react';

export interface ConfirmationRequest {
  description: string;
  args: unknown;
}

export interface ConfirmationState {
  pending: boolean;
  request: ConfirmationRequest | null;
  confirm: () => void;
  deny: () => void;
}

export function useConfirmation(): {
  state: ConfirmationState;
  requestConfirmation: (description: string, args: unknown) => Promise<boolean>;
} {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  const deny = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  const requestConfirmation = useCallback(
    (description: string, args: unknown): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setRequest({ description, args });
      });
    },
    [],
  );

  return {
    state: {
      pending: request !== null,
      request,
      confirm,
      deny,
    },
    requestConfirmation,
  };
}
