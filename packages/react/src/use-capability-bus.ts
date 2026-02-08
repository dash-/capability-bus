import { useBusContext } from './context.js';
import type { CapabilityBus } from '@capability-bus/core';

export function useCapabilityBus(): CapabilityBus {
  return useBusContext();
}
