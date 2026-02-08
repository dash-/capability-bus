# Tutorial: Adding an AI Assistant to an Existing React App

This tutorial walks through adding a Capability Bus and AI agent bridge to an existing React application. By the end, your users will be able to interact with your app through a chat panel that invokes the same operations as your UI buttons.

## Step 1: Install

```bash
npm install @capability-bus/core @capability-bus/react zod
```

## Step 2: Identify Capabilities

Look at your app and pick 3-5 actions a user might ask for by name in a chat. Good candidates:

- Actions tied to buttons or form submissions
- Operations with clear inputs and outputs
- Things a user might say "do X for me"

For example, in a project management app:
- `task.create` — Create a new task
- `task.complete` — Mark a task as done
- `tasks.list` — List current tasks

## Step 3: Define Capabilities with Zod Schemas

```typescript
// capabilities/tasks.ts
import { z } from 'zod';
import type { CapabilityDefinition } from '@capability-bus/core';

export const taskCreate: CapabilityDefinition = {
  name: 'task.create',
  description: 'Create a new task with a title and optional description.',
  input: z.object({
    title: z.string().describe('The task title'),
    description: z.string().optional().describe('Optional task description'),
  }),
  output: z.object({
    taskId: z.string(),
    title: z.string(),
  }),
  sideEffect: 'network',       // makes an API call
  permissions: ['user.authenticated'],
  concurrency: 'concurrent',
  handler: async (input, context) => {
    // Call your existing API/service
    const task = await api.tasks.create(input);
    return { taskId: task.id, title: task.title };
  },
};

export const taskComplete: CapabilityDefinition = {
  name: 'task.complete',
  description: 'Mark a task as complete.',
  input: z.object({
    taskId: z.string().describe('The ID of the task to complete'),
  }),
  output: z.object({
    completed: z.boolean(),
  }),
  sideEffect: 'network',
  permissions: ['user.authenticated'],
  concurrency: 'concurrent',
  handler: async (input) => {
    await api.tasks.update(input.taskId, { completed: true });
    return { completed: true };
  },
};
```

## Step 4: Create and Register the Bus

```typescript
// bus.ts
import { CapabilityBus } from '@capability-bus/core';
import { taskCreate, taskComplete } from './capabilities/tasks';

export const bus = new CapabilityBus({
  appContext: () => ({
    permissions: getCurrentUser()?.permissions ?? [],
  }),
});

bus.register(taskCreate);
bus.register(taskComplete);
```

## Step 5: Wire UI Components to the Bus

Replace direct API calls in your components with bus invocations.

**Before:**
```tsx
function CreateTaskButton() {
  const handleClick = async () => {
    const task = await api.tasks.create({ title: 'New Task' });
    setTasks(prev => [...prev, task]);
  };
  return <button onClick={handleClick}>Create Task</button>;
}
```

**After:**
```tsx
import { useCapability } from '@capability-bus/react';

function CreateTaskButton() {
  const { invoke, isLoading } = useCapability('task.create');

  return (
    <button
      disabled={isLoading}
      onClick={() => invoke({ title: 'New Task' })}
    >
      {isLoading ? 'Creating...' : 'Create Task'}
    </button>
  );
}
```

## Step 6: Add BusProvider

Wrap your app with `BusProvider`:

```tsx
import { BusProvider } from '@capability-bus/react';
import { bus } from './bus';

function App() {
  return (
    <BusProvider bus={bus}>
      <YourExistingApp />
      <ChatPanel />
    </BusProvider>
  );
}
```

## Step 7: Build the Agent Bridge

The agent bridge connects LLM tool calls to bus invocations.

```tsx
// components/ChatPanel.tsx
import { useState, useCallback, useRef } from 'react';
import { useCapabilityBus, useConfirmation } from '@capability-bus/react';

export function ChatPanel() {
  const bus = useCapabilityBus();
  const { state: confirmState, requestConfirmation } = useConfirmation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleSend = useCallback(async () => {
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Get available tools from the bus
    const tools = bus.getToolDefinitions({ permissions: getCurrentUserPermissions() });

    // Send to your LLM backend (or use the mock agent for development)
    const response = await callAgent(userMessage, tools, async (toolCall) => {
      // Check if destructive and needs confirmation
      const cap = bus.getCapability(toolCall.name);
      if (cap?.sideEffect === 'destructive') {
        const confirmed = await requestConfirmation(cap.description, toolCall.arguments);
        if (!confirmed) return JSON.stringify({ status: 'error', code: 'FORBIDDEN',
          message: 'User declined' });
      }

      // Invoke through the bus — same pipeline as UI clicks
      const result = await bus.invoke(
        toolCall.name,
        toolCall.arguments,
        { type: 'agent', source: 'chat', triggeringMessage: userMessage },
      );
      return JSON.stringify(result);
    });

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
  }, [input, bus, requestConfirmation]);

  return (
    <div>
      {/* Message list, input field, confirmation dialog */}
    </div>
  );
}
```

## Step 8: Add Confirmation for Destructive Actions

The `useConfirmation` hook manages the dialog lifecycle:

```tsx
const { state: confirmState, requestConfirmation } = useConfirmation();

// In your JSX:
{confirmState.pending && (
  <div className="dialog-overlay">
    <div className="dialog">
      <p>{confirmState.request.description}</p>
      <pre>{JSON.stringify(confirmState.request.args, null, 2)}</pre>
      <button onClick={confirmState.deny}>Cancel</button>
      <button onClick={confirmState.confirm}>Confirm</button>
    </div>
  </div>
)}
```

## Step 9: Test Without an LLM

During development, you don't need an API key. Build a simple mock agent:

```typescript
class MockAgent {
  async chat(message, tools, onToolCall) {
    if (message.includes('create task')) {
      const result = await onToolCall({
        id: 'mock_1',
        name: 'task.create',
        arguments: { title: 'New task from AI' },
      });
      return `Created a task: ${JSON.parse(result).data?.title}`;
    }
    return `I can help with: ${tools.map(t => t.name).join(', ')}`;
  }
}
```

## What You Get

After these steps:
- Every UI action and every agent action flows through the same bus
- Schema validation catches bad inputs from any caller
- The audit log shows who did what and when
- Destructive agent actions always require user confirmation
- Tests can invoke capabilities directly without rendering UI
- The debug panel (if you add one) shows the full invocation stream
