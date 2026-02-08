import { z } from 'zod';
import type { CapabilityDefinition } from '@capability-bus/core';
import type { AppState } from '../store/index.js';

export function createOrderCapabilities(
  getState: () => AppState,
): CapabilityDefinition[] {
  const ordersGetHistory: CapabilityDefinition = {
    name: 'orders.getHistory',
    description: 'Get the history of all placed orders.',
    input: z.object({}),
    output: z.object({
      orders: z.array(
        z.object({
          orderId: z.string(),
          total: z.number(),
          itemCount: z.number(),
          estimatedDelivery: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async () => {
      const state = getState();
      return {
        orders: state.orders.map((o) => ({
          orderId: o.orderId,
          total: o.total,
          itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
          estimatedDelivery: o.estimatedDelivery,
          createdAt: o.createdAt,
        })),
      };
    },
  };

  const ordersGetStatus: CapabilityDefinition = {
    name: 'orders.getStatus',
    description: 'Get the status and details of a specific order by its ID.',
    input: z.object({
      orderId: z.string().describe('The order ID to look up'),
    }),
    output: z.object({
      orderId: z.string(),
      status: z.string(),
      total: z.number(),
      items: z.array(
        z.object({ name: z.string(), quantity: z.number(), price: z.number() }),
      ),
      estimatedDelivery: z.string(),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => {
      const order = getState().orders.find((o) => o.orderId === input.orderId);
      if (!order) throw new Error(`Order not found: ${input.orderId}`);
      return {
        orderId: order.orderId,
        status: 'confirmed',
        total: order.total,
        items: order.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
        })),
        estimatedDelivery: order.estimatedDelivery,
      };
    },
  };

  return [ordersGetHistory, ordersGetStatus];
}
