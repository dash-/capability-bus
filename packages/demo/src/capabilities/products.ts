import { z } from 'zod';
import type { CapabilityDefinition } from '@capability-bus/core';
import type { AppState } from '../store/index.js';

export function createProductCapabilities(
  getState: () => AppState,
): CapabilityDefinition[] {
  const productsSearch: CapabilityDefinition = {
    name: 'products.search',
    description: 'Search the product catalog by name or category.',
    input: z.object({
      query: z.string().describe('Search query to match against product names and descriptions'),
    }),
    output: z.object({
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          category: z.string(),
        }),
      ),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => {
      const q = input.query.toLowerCase();
      const matches = getState().products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
      return {
        products: matches.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category,
        })),
      };
    },
  };

  const productsGetDetails: CapabilityDefinition = {
    name: 'products.getDetails',
    description: 'Get full details for a specific product by its ID.',
    input: z.object({
      productId: z.string().describe('The product ID'),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      price: z.number(),
      imageUrl: z.string(),
      category: z.string(),
    }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => {
      const product = getState().products.find((p) => p.id === input.productId);
      if (!product) throw new Error(`Product not found: ${input.productId}`);
      return product;
    },
  };

  return [productsSearch, productsGetDetails];
}
