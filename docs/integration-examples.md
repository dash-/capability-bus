# Integration Examples

## Redux

Existing Redux actions become capability handlers. The bus adds schema validation, caller metadata, and manifest generation on top.

```typescript
import { z } from 'zod';
import { CapabilityBus } from '@capability-bus/core';
import { store } from './store';
import { addItem } from './cartSlice';

const bus = new CapabilityBus();

bus.register({
  name: 'cart.addItem',
  description: 'Add a product to the shopping cart.',
  input: z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  }),
  output: z.object({
    itemCount: z.number(),
  }),
  sideEffect: 'ui-only',
  permissions: [],
  concurrency: 'concurrent',
  handler: async (input) => {
    // Dispatch existing Redux action
    store.dispatch(addItem(input));
    const state = store.getState();
    return { itemCount: state.cart.items.length };
  },
});
```

## Zustand

```typescript
import { z } from 'zod';
import { CapabilityBus } from '@capability-bus/core';
import { useCartStore } from './stores/cart';

const bus = new CapabilityBus();

bus.register({
  name: 'cart.addItem',
  description: 'Add a product to the shopping cart.',
  input: z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  }),
  output: z.object({
    itemCount: z.number(),
  }),
  sideEffect: 'ui-only',
  permissions: [],
  concurrency: 'concurrent',
  handler: async (input) => {
    // Call existing Zustand action
    useCartStore.getState().addItem(input.productId, input.quantity);
    return { itemCount: useCartStore.getState().items.length };
  },
});
```

## Vanilla JavaScript (No Framework)

The core library has zero framework dependencies.

```typescript
import { z } from 'zod';
import { CapabilityBus } from '@capability-bus/core';

const bus = new CapabilityBus();

bus.register({
  name: 'counter.increment',
  description: 'Increment the counter by a given amount.',
  input: z.object({ amount: z.number().int().positive() }),
  output: z.object({ value: z.number() }),
  sideEffect: 'ui-only',
  permissions: [],
  concurrency: 'concurrent',
  handler: async (input) => {
    count += input.amount;
    document.getElementById('count')!.textContent = String(count);
    return { value: count };
  },
});

let count = 0;

// UI caller
document.getElementById('btn')!.addEventListener('click', () => {
  bus.invoke('counter.increment', { amount: 1 }, { type: 'ui', source: 'button' });
});

// Agent caller (same code path)
bus.invoke('counter.increment', { amount: 5 }, { type: 'agent', source: 'chat' });
```

## Server-Side (Node.js)

The bus works identically in Node.js for server-side capabilities.

```typescript
import { z } from 'zod';
import { CapabilityBus } from '@capability-bus/core';
import { db } from './database';

const bus = new CapabilityBus({
  appContext: () => ({
    permissions: ['service.internal'],
  }),
});

bus.register({
  name: 'user.create',
  description: 'Create a new user account.',
  input: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  output: z.object({
    userId: z.string(),
  }),
  sideEffect: 'network',
  permissions: ['service.internal'],
  concurrency: 'concurrent',
  handler: async (input) => {
    const user = await db.users.create({ data: input });
    return { userId: user.id };
  },
});
```

## Testing with the Bus

Capabilities invoked through the bus are decoupled from UI, making them easy to test.

```typescript
import { describe, it, expect } from 'vitest';
import { CapabilityBus } from '@capability-bus/core';
import { registerCartCapabilities } from './capabilities/cart';

describe('cart capabilities', () => {
  it('adds item and returns updated totals', async () => {
    const bus = new CapabilityBus();
    registerCartCapabilities(bus);

    const result = await bus.invoke(
      'cart.addItem',
      { productId: 'prod_1', quantity: 2 },
      { type: 'test', source: 'cart.test' },
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.itemCount).toBe(2);
    }
  });
});
```
