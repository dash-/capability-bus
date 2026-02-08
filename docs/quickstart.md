# Quickstart Guide

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

## Setup

```bash
git clone <repo-url>
cd capability-bus
pnpm install
pnpm dev
```

The demo store opens at `http://localhost:5173`.

## Guided Walkthrough

### 1. Browse and Add to Cart (UI)

Click **"Add to Cart"** on any product. The button invokes `cart.addItem` through the Capability Bus. The cart badge in the header updates.

Open the **Bus Debug Panel** at the bottom of the page to see the invocation: capability name, caller type (`ui`), result status, and duration.

### 2. Ask the AI Assistant (Agent)

In the chat panel on the right, type:

```
add the running shoes to my cart
```

The mock agent:
1. Calls `products.search` with `{"query": "running shoes"}` to find the product
2. Calls `cart.addItem` with the product ID

Both tool calls appear inline in the chat. The cart updates — same result as clicking the button, because both go through the same bus pipeline.

### 3. Submit an Order (Destructive Action)

Type:

```
submit my order to my home address
```

The agent calls `cart.getSummary` to inspect the cart, then attempts `checkout.submit`. Because `checkout.submit` is classified as `destructive`, a **confirmation dialog** appears showing the operation description and arguments. Click **Confirm** to place the order.

The app navigates to the Order Confirmation page showing the order ID, delivery estimate, and line items.

### 4. Inspect the Audit Trail

Open the Bus Debug Panel. Every invocation is logged:
- Capability name
- Caller type (ui or agent)
- Result (success or error code)
- Duration in milliseconds

### 5. Try Error Scenarios

- Type "submit my order" with an empty cart → `PRECONDITION_FAILED` error with recovery hint
- Type "clear my cart" then "submit my order" → same error
- Type "search for jetpack" → no results found

## Mock Mode vs Real Agent

By default, the demo runs with a **mock agent** — a pattern-matching system that doesn't require an API key. The mock badge appears in the chat header.

To use real Claude:

1. Copy `.env.example` to `.env`
2. Add your Anthropic API key: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart the dev server

The agent bridge in the demo is designed to support both modes. The mock agent is useful for understanding the pattern without external dependencies.

## Running Tests

```bash
pnpm test        # Run all tests
pnpm test:watch  # Watch mode
```

The test suite covers the core bus (validation, permissions, concurrency, idempotency, audit, events, middleware) and React hooks.
