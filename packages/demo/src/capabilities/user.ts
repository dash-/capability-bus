import { z } from 'zod';
import type { CapabilityDefinition } from '@capability-bus/core';
import type { AppState } from '../store/index.js';

export function createUserCapabilities(
  getState: () => AppState,
): CapabilityDefinition[] {
  const userGetProfile: CapabilityDefinition = {
    name: 'user.getProfile',
    description: 'Get the current user profile, including saved addresses and payment methods.',
    input: z.object({}),
    output: z.object({
      name: z.string(),
      email: z.string(),
      addresses: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          street: z.string(),
          city: z.string(),
          state: z.string(),
          zip: z.string(),
        }),
      ),
      paymentMethods: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      ),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async () => {
      const state = getState();
      return {
        name: state.user.name,
        email: state.user.email,
        addresses: state.user.addresses,
        paymentMethods: state.user.paymentMethods.map((p) => ({ id: p.id, label: p.label })),
      };
    },
  };

  return [userGetProfile];
}
