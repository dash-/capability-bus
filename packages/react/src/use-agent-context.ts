import { useMemo } from 'react';
import { useBusContext } from './context.js';

export interface AgentContextValue {
  availableCapabilities: string[];
  contextData: Record<string, unknown>;
}

export function useAgentContext(
  contextProvider: () => Record<string, unknown>,
  deps: unknown[] = [],
): AgentContextValue {
  const bus = useBusContext();

  return useMemo(() => {
    return {
      availableCapabilities: bus.getRegisteredNames(),
      contextData: contextProvider(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, ...deps]);
}
