import { z } from 'zod';
import type { CapabilityDefinition } from '@capability-bus/core';
import type { AppState, AppAction } from '../store/index.js';

export function createCartCapabilities(
  getState: () => AppState,
  dispatch: (action: AppAction) => void,
): CapabilityDefinition[] {
  const cartAddItem: CapabilityDefinition = {
    name: 'cart.addItem',
    description: 'Add a product to the shopping cart.',
    input: z.object({
      productId: z.string().describe('The product ID to add'),
      quantity: z.number().int().positive().default(1).describe('Quantity to add'),
    }),
    output: z.object({
      cartTotal: z.number(),
      itemCount: z.number(),
    }),
    sideEffect: 'ui-only',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => {
      const state = getState();
      const product = state.products.find((p) => p.id === input.productId);
      if (!product) throw new Error(`Product not found: ${input.productId}`);

      // Compute expected result from current state before dispatching,
      // since React's useReducer dispatch doesn't update stateRef synchronously.
      const existing = state.cart.find((i) => i.product.id === input.productId);
      const updatedCart = existing
        ? state.cart.map((i) =>
            i.product.id === input.productId
              ? { ...i, quantity: i.quantity + input.quantity }
              : i,
          )
        : [...state.cart, { product, quantity: input.quantity }];
      const total = updatedCart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const count = updatedCart.reduce((sum, i) => sum + i.quantity, 0);

      dispatch({ type: 'CART_ADD', product, quantity: input.quantity });
      return { cartTotal: Math.round(total * 100) / 100, itemCount: count };
    },
  };

  const cartRemoveItem: CapabilityDefinition = {
    name: 'cart.removeItem',
    description: 'Remove a product from the shopping cart.',
    input: z.object({
      productId: z.string().describe('The product ID to remove'),
    }),
    output: z.object({
      cartTotal: z.number(),
      itemCount: z.number(),
    }),
    sideEffect: 'ui-only',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => {
      const state = getState();
      const updatedCart = state.cart.filter((i) => i.product.id !== input.productId);
      const total = updatedCart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const count = updatedCart.reduce((sum, i) => sum + i.quantity, 0);

      dispatch({ type: 'CART_REMOVE', productId: input.productId });
      return { cartTotal: Math.round(total * 100) / 100, itemCount: count };
    },
  };

  const cartUpdateQuantity: CapabilityDefinition = {
    name: 'cart.updateQuantity',
    description: 'Update the quantity of a product in the cart.',
    input: z.object({
      productId: z.string().describe('The product ID'),
      quantity: z.number().int().positive().describe('New quantity'),
    }),
    output: z.object({
      cartTotal: z.number(),
      itemCount: z.number(),
    }),
    sideEffect: 'ui-only',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => {
      const state = getState();
      const updatedCart = state.cart.map((i) =>
        i.product.id === input.productId ? { ...i, quantity: input.quantity } : i,
      );
      const total = updatedCart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const count = updatedCart.reduce((sum, i) => sum + i.quantity, 0);

      dispatch({ type: 'CART_UPDATE_QUANTITY', productId: input.productId, quantity: input.quantity });
      return { cartTotal: Math.round(total * 100) / 100, itemCount: count };
    },
  };

  const cartGetSummary: CapabilityDefinition = {
    name: 'cart.getSummary',
    description: 'Get a summary of the current cart contents, totals, and available shipping/payment options.',
    input: z.object({}),
    output: z.object({
      items: z.array(
        z.object({
          productId: z.string(),
          name: z.string(),
          quantity: z.number(),
          price: z.number(),
          lineTotal: z.number(),
        }),
      ),
      subtotal: z.number(),
      itemCount: z.number(),
      savedAddresses: z.array(z.object({ id: z.string(), label: z.string() })),
      savedPaymentMethods: z.array(z.object({ id: z.string(), label: z.string() })),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async () => {
      const state = getState();
      const items = state.cart.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        price: i.product.price,
        lineTotal: Math.round(i.product.price * i.quantity * 100) / 100,
      }));
      const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
      return {
        items,
        subtotal,
        itemCount: state.cart.reduce((sum, i) => sum + i.quantity, 0),
        savedAddresses: state.user.addresses.map((a) => ({ id: a.id, label: a.label })),
        savedPaymentMethods: state.user.paymentMethods.map((p) => ({ id: p.id, label: p.label })),
      };
    },
  };

  const cartClear: CapabilityDefinition = {
    name: 'cart.clear',
    description: 'Remove all items from the shopping cart.',
    input: z.object({}),
    output: z.object({ cleared: z.boolean() }),
    sideEffect: 'ui-only',
    permissions: [],
    concurrency: 'exclusive',
    handler: async () => {
      dispatch({ type: 'CART_CLEAR' });
      return { cleared: true };
    },
  };

  return [cartAddItem, cartRemoveItem, cartUpdateQuantity, cartGetSummary, cartClear];
}
