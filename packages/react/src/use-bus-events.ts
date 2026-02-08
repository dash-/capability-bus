import { useEffect } from 'react';
import type { BusEvent } from '@capability-bus/core';
import { useBusContext } from './context.js';

export function useBusEvents(
  handler: (event: BusEvent) => void,
  filter?: (event: BusEvent) => boolean,
): void {
  const bus = useBusContext();

  useEffect(() => {
    const listener = (event: BusEvent) => {
      if (!filter || filter(event)) {
        handler(event);
      }
    };
    return bus.subscribe(listener);
  }, [bus, handler, filter]);
}
