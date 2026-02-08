import type { CapabilityBus } from '@capability-bus/core';
import type { AppState, AppAction } from '../store/index.js';
import { createProductCapabilities } from './products.js';
import { createCartCapabilities } from './cart.js';
import { createCheckoutCapabilities } from './checkout.js';
import { createUserCapabilities } from './user.js';
import { createOrderCapabilities } from './orders.js';

export function registerAllCapabilities(
  bus: CapabilityBus,
  getState: () => AppState,
  dispatch: (action: AppAction) => void,
): void {
  const allCapabilities = [
    ...createProductCapabilities(getState),
    ...createCartCapabilities(getState, dispatch),
    ...createCheckoutCapabilities(getState, dispatch),
    ...createUserCapabilities(getState),
    ...createOrderCapabilities(getState),
  ];

  for (const cap of allCapabilities) {
    bus.register(cap);
  }
}
