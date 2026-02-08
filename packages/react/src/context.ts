import { createContext, useContext } from 'react';
import type { CapabilityBus } from '@capability-bus/core';

export const BusContext = createContext<CapabilityBus | null>(null);

export function useBusContext(): CapabilityBus {
  const bus = useContext(BusContext);
  if (!bus) {
    throw new Error('useCapabilityBus must be used within a <BusProvider>');
  }
  return bus;
}
