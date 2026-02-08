import { z } from 'zod';
import type { CapabilityDefinition } from '@capability-bus/core';
import type { AppState, AppAction } from '../store/index.js';
import type { Order } from '../store/types.js';

let orderCounter = 1000;

export function createCheckoutCapabilities(
  getState: () => AppState,
  dispatch: (action: AppAction) => void,
): CapabilityDefinition[] {
  const checkoutValidate: CapabilityDefinition = {
    name: 'checkout.validate',
    description: 'Check whether the cart is ready for checkout. Returns any issues that need to be resolved.',
    input: z.object({}),
    output: z.object({
      ready: z.boolean(),
      issues: z.array(z.string()),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async () => {
      const state = getState();
      const issues: string[] = [];
      if (state.cart.length === 0) issues.push('Cart is empty');
      if (state.user.addresses.length === 0) issues.push('No shipping address on file');
      if (state.user.paymentMethods.length === 0) issues.push('No payment method on file');
      return { ready: issues.length === 0, issues };
    },
  };

  const checkoutSubmit: CapabilityDefinition = {
    name: 'checkout.submit',
    description: 'Submit the current cart as an order. Charges the saved payment method and creates a shipping label.',
    input: z.object({
      shippingAddressId: z.string().describe('ID of a saved shipping address'),
      paymentMethodId: z.string().describe('ID of a saved payment method'),
      giftMessage: z.string().optional().describe('Optional gift message to include with the order'),
    }),
    output: z.object({
      orderId: z.string(),
      estimatedDelivery: z.string(),
      total: z.number(),
    }),
    sideEffect: 'destructive',
    permissions: [],
    concurrency: 'exclusive',
    preconditions: async () => {
      const state = getState();
      if (state.cart.length === 0) {
        return {
          met: false,
          code: 'PRECONDITION_FAILED',
          message: 'Cannot submit order: cart is empty.',
          recoveryHint: 'Invoke cart.addItem to add products to the cart first.',
        };
      }
      return { met: true };
    },
    handler: async (input) => {
      const state = getState();
      const address = state.user.addresses.find((a) => a.id === input.shippingAddressId);
      if (!address) throw new Error(`Address not found: ${input.shippingAddressId}`);
      const payment = state.user.paymentMethods.find((p) => p.id === input.paymentMethodId);
      if (!payment) throw new Error(`Payment method not found: ${input.paymentMethodId}`);

      const total = Math.round(
        state.cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0) * 100,
      ) / 100;

      const delivery = new Date();
      delivery.setDate(delivery.getDate() + 4);

      const order: Order = {
        orderId: `ORD-${++orderCounter}`,
        items: [...state.cart],
        total,
        shippingAddress: address,
        paymentMethod: payment,
        estimatedDelivery: delivery.toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: 'ORDER_PLACED', order });

      return {
        orderId: order.orderId,
        estimatedDelivery: order.estimatedDelivery,
        total: order.total,
      };
    },
  };

  return [checkoutValidate, checkoutSubmit];
}
