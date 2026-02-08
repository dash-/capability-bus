import React from 'react';
import type { CapabilityBus } from '@capability-bus/core';
import { BusContext } from './context.js';

export interface BusProviderProps {
  bus: CapabilityBus;
  children: React.ReactNode;
}

export function BusProvider({ bus, children }: BusProviderProps): React.JSX.Element {
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
}
