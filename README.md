# Capability Bus

A reference implementation of the **Capability Bus** pattern — a centralized dispatch layer for application actions that AI agents, UI components, and tests all invoke through the same validated, permissioned pipeline.

Read the full architecture paper: [Agent-Ready Architecture: The Capability Bus Pattern](docs/agent-ready-architecture-v3.md)

## What is this?

The Capability Bus mediates all meaningful application actions through a single execution engine. Whether a user clicks a button or an AI assistant issues a tool call, the operation flows through the same code path: schema validation, permission checks, precondition enforcement, handler execution, event emission, and audit logging.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  UI Button   │    │  AI Agent   │    │    Test     │
└──────┬───────┘    └──────┬──────┘    └──────┬──────┘
       │                   │                  │
       └───────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Capability  │
                    │    Bus      │
                    │             │
                    │ validate →  │
                    │ permissions→│
                    │ preconditions→
                    │ execute →   │
                    │ emit →      │
                    │ audit       │
                    └─────────────┘
```

## Packages

| Package | Description |
|---|---|
| [`@capability-bus/core`](packages/core) | Framework-agnostic TypeScript core. CapabilityBus class, types, middleware, manifest generation. |
| [`@capability-bus/react`](packages/react) | React bindings. BusProvider, useCapability, useBusEvents, useConfirmation hooks. |
| [`demo`](packages/demo) | E-commerce demo app with AI chat panel (mock agent, no API key required). |

## Quick Start

```bash
git clone <repo-url> && cd capability-bus
pnpm install
pnpm dev
```

The demo app runs at `http://localhost:5173`. Try:
1. Click "Add to Cart" on a product
2. Type "add the running shoes to my cart" in the AI chat panel
3. Type "submit my order to my home address" — a confirmation dialog appears for this destructive action
4. Open the Bus Debug Panel to see every invocation with caller type, result, and duration

See the [Quickstart Guide](docs/quickstart.md) for a detailed walkthrough.

## Documentation

- [Quickstart Guide](docs/quickstart.md) — Setup and guided demo walkthrough
- [API Reference](docs/api-reference.md) — Full API documentation for core and react packages
- [Integration Examples](docs/integration-examples.md) — Patterns for Redux, Zustand, vanilla JS
- [Adding an Agent Bridge](docs/tutorial-agent-bridge.md) — Step-by-step tutorial for existing apps
- [Architecture Paper](docs/agent-ready-architecture-v3.md) — The full design rationale

## Core Concepts

**Capabilities** are named, self-describing operations: `cart.addItem`, `checkout.submit`, `products.search`. Each defines a Zod input/output schema, side-effect classification, permissions, and concurrency policy.

**Side-effect classification** drives safety policy:
- `pure` — no side effects, safe to invoke freely
- `ui-only` — local state changes only
- `network` — external requests
- `destructive` — irreversible (requires confirmation when agent-invoked)

**The bus** validates inputs, checks permissions, enforces concurrency, runs middleware, executes handlers, emits events, and records audit logs — identically for UI, agent, and test callers.

**The manifest** is a JSON description of all capabilities, formatted for LLM tool use. The agent sees what the application can do and invokes capabilities through structured tool calls.

## License

MIT
