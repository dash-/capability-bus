import type { AgentService, AgentResponse, ConversationMessage, ToolCall } from './agent-service.js';
import type { ToolDefinition } from '@capability-bus/core';

export class MockAgentService implements AgentService {
  async chat(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>,
  ): Promise<AgentResponse> {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return { text: "I didn't catch that. Could you try again?" };
    }

    const input = lastMessage.content.toLowerCase();

    // Pattern: add something to cart
    if (input.includes('add') && input.includes('cart')) {
      return this.handleAddToCart(input, tools, onToolCall);
    }

    // Pattern: show/view cart or what's in my cart
    if (
      (input.includes('cart') && (input.includes('show') || input.includes('view') || input.includes("what"))) ||
      input.includes('cart summary')
    ) {
      return this.handleViewCart(onToolCall);
    }

    // Pattern: submit/place order or checkout
    if (input.includes('submit') || input.includes('place order') || input.includes('checkout')) {
      return this.handleCheckout(input, onToolCall);
    }

    // Pattern: search products
    if (input.includes('search') || input.includes('find') || input.includes('looking for')) {
      return this.handleSearch(input, onToolCall);
    }

    // Pattern: remove from cart
    if (input.includes('remove') && input.includes('cart')) {
      return this.handleRemoveFromCart(input, onToolCall);
    }

    // Pattern: clear cart
    if (input.includes('clear') && input.includes('cart')) {
      const result = await onToolCall({
        id: `mock_${Date.now()}`,
        name: 'cart.clear',
        arguments: {},
      });
      return { text: 'Done! Your cart has been cleared.' };
    }

    // Pattern: order status/history
    if (input.includes('order') && (input.includes('status') || input.includes('history'))) {
      const result = await onToolCall({
        id: `mock_${Date.now()}`,
        name: 'orders.getHistory',
        arguments: {},
      });
      const parsed = JSON.parse(result);
      if (parsed.status === 'success' && parsed.data.orders.length > 0) {
        const orders = parsed.data.orders;
        return {
          text: `You have ${orders.length} order(s):\n${orders
            .map((o: { orderId: string; total: number; estimatedDelivery: string }) => `- ${o.orderId}: $${o.total.toFixed(2)} (delivery: ${o.estimatedDelivery})`)
            .join('\n')}`,
        };
      }
      return { text: "You don't have any orders yet." };
    }

    // Default: list available capabilities
    const capNames = tools.map((t) => t.name).join(', ');
    return {
      text: `I can help you with: ${capNames}. Try asking me to add something to your cart, view your cart, or submit an order.`,
    };
  }

  private async handleAddToCart(
    input: string,
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>,
  ): Promise<AgentResponse> {
    // First search for the product
    const searchQuery = input
      .replace(/add/g, '')
      .replace(/to (my )?cart/g, '')
      .replace(/the/g, '')
      .replace(/please/g, '')
      .trim();

    const searchResult = await onToolCall({
      id: `mock_${Date.now()}_search`,
      name: 'products.search',
      arguments: { query: searchQuery || 'shirt' },
    });

    const searchParsed = JSON.parse(searchResult);
    if (searchParsed.status !== 'success' || searchParsed.data.products.length === 0) {
      return { text: `I couldn't find any products matching "${searchQuery}". Try searching for something else.` };
    }

    const product = searchParsed.data.products[0];
    const addResult = await onToolCall({
      id: `mock_${Date.now()}_add`,
      name: 'cart.addItem',
      arguments: { productId: product.id, quantity: 1 },
    });

    const addParsed = JSON.parse(addResult);
    if (addParsed.status === 'success') {
      return {
        text: `Added **${product.name}** ($${product.price.toFixed(2)}) to your cart. Your cart now has ${addParsed.data.itemCount} item(s) totaling $${addParsed.data.cartTotal.toFixed(2)}.`,
      };
    }
    return { text: `I had trouble adding that to your cart: ${addParsed.message}` };
  }

  private async handleViewCart(
    onToolCall: (toolCall: ToolCall) => Promise<string>,
  ): Promise<AgentResponse> {
    const result = await onToolCall({
      id: `mock_${Date.now()}`,
      name: 'cart.getSummary',
      arguments: {},
    });

    const parsed = JSON.parse(result);
    if (parsed.status !== 'success') {
      return { text: 'I had trouble getting your cart summary.' };
    }

    const { items, subtotal, itemCount } = parsed.data;
    if (items.length === 0) {
      return { text: 'Your cart is empty. Browse the products page to add items.' };
    }

    const itemList = items
      .map((i: { name: string; quantity: number; lineTotal: number }) => `- ${i.name} x${i.quantity}: $${i.lineTotal.toFixed(2)}`)
      .join('\n');
    return {
      text: `Your cart (${itemCount} items):\n${itemList}\n\n**Subtotal: $${subtotal.toFixed(2)}**`,
    };
  }

  private async handleCheckout(
    input: string,
    onToolCall: (toolCall: ToolCall) => Promise<string>,
  ): Promise<AgentResponse> {
    // First get cart summary to find addresses and payment methods
    const summaryResult = await onToolCall({
      id: `mock_${Date.now()}_summary`,
      name: 'cart.getSummary',
      arguments: {},
    });

    const summary = JSON.parse(summaryResult);
    if (summary.status !== 'success' || summary.data.items.length === 0) {
      return { text: "Your cart is empty. Add some items before checking out." };
    }

    // Find address - default to "home" if mentioned, otherwise first
    const addresses = summary.data.savedAddresses;
    const payments = summary.data.savedPaymentMethods;

    let addressId = addresses[0]?.id;
    if (input.includes('home')) {
      const home = addresses.find((a: { label: string }) => a.label.toLowerCase() === 'home');
      if (home) addressId = home.id;
    } else if (input.includes('work')) {
      const work = addresses.find((a: { label: string }) => a.label.toLowerCase() === 'work');
      if (work) addressId = work.id;
    }

    const paymentId = payments[0]?.id;

    // Submit the order
    const orderResult = await onToolCall({
      id: `mock_${Date.now()}_order`,
      name: 'checkout.submit',
      arguments: {
        shippingAddressId: addressId,
        paymentMethodId: paymentId,
      },
    });

    const order = JSON.parse(orderResult);
    if (order.status === 'success') {
      return {
        text: `Your order **${order.data.orderId}** has been placed! Total: $${order.data.total.toFixed(2)}. Estimated delivery: ${order.data.estimatedDelivery}.`,
      };
    }

    if (order.code === 'FORBIDDEN' && order.message === 'User declined the action') {
      return { text: 'No problem, the order was not placed.' };
    }

    return { text: `I couldn't place the order: ${order.message}${order.recoveryHint ? ` Hint: ${order.recoveryHint}` : ''}` };
  }

  private async handleSearch(
    input: string,
    onToolCall: (toolCall: ToolCall) => Promise<string>,
  ): Promise<AgentResponse> {
    const query = input
      .replace(/search (for)?/g, '')
      .replace(/find/g, '')
      .replace(/looking for/g, '')
      .replace(/i('| a)?m/g, '')
      .replace(/please/g, '')
      .trim();

    const result = await onToolCall({
      id: `mock_${Date.now()}`,
      name: 'products.search',
      arguments: { query: query || '' },
    });

    const parsed = JSON.parse(result);
    if (parsed.status !== 'success' || parsed.data.products.length === 0) {
      return { text: `No products found for "${query}".` };
    }

    const products = parsed.data.products;
    const list = products
      .map((p: { name: string; price: number }) => `- ${p.name} ($${p.price.toFixed(2)})`)
      .join('\n');
    return { text: `Found ${products.length} product(s):\n${list}` };
  }

  private async handleRemoveFromCart(
    input: string,
    onToolCall: (toolCall: ToolCall) => Promise<string>,
  ): Promise<AgentResponse> {
    // Get cart to find what to remove
    const summaryResult = await onToolCall({
      id: `mock_${Date.now()}_summary`,
      name: 'cart.getSummary',
      arguments: {},
    });

    const summary = JSON.parse(summaryResult);
    if (summary.status !== 'success' || summary.data.items.length === 0) {
      return { text: 'Your cart is already empty.' };
    }

    // Try to match product name from input
    const items = summary.data.items;
    const match = items.find((i: { name: string }) => input.includes(i.name.toLowerCase()));
    const item = match || items[items.length - 1]; // remove last added if no match

    const result = await onToolCall({
      id: `mock_${Date.now()}_remove`,
      name: 'cart.removeItem',
      arguments: { productId: item.productId },
    });

    const parsed = JSON.parse(result);
    if (parsed.status === 'success') {
      return { text: `Removed **${item.name}** from your cart.` };
    }
    return { text: `I had trouble removing that item: ${parsed.message}` };
  }
}
