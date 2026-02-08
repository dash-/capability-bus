import React, { useState, useCallback, useRef } from 'react';
import { useCapabilityBus } from '@capability-bus/react';
import { useConfirmation } from '@capability-bus/react';
import { createConfirmationMiddleware } from '@capability-bus/core';
import type { InvocationResult } from '@capability-bus/core';
import { MockAgentService } from '../../agent/mock-agent.js';
import type { AgentService, ConversationMessage } from '../../agent/agent-service.js';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ToolCallDisplay {
  name: string;
  args: unknown;
  result?: InvocationResult;
}

export function ChatPanel() {
  const bus = useCapabilityBus();
  const { state: confirmState, requestConfirmation } = useConfirmation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'AI assistant ready. Try "add the blue shirt to my cart" or "submit my order".' },
  ]);
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agentRef = useRef<AgentService>(new MockAgentService());

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isThinking) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    scrollToBottom();

    try {
      const tools = bus.getToolDefinitions({ permissions: [] });
      const conversationMessages: ConversationMessage[] = [
        { role: 'user', content: userMessage },
      ];

      const response = await agentRef.current.chat(
        conversationMessages,
        tools,
        async (toolCall) => {
          // Show the tool call
          const display: ToolCallDisplay = { name: toolCall.name, args: toolCall.arguments };
          setToolCalls((prev) => [...prev, display]);
          scrollToBottom();

          // Check if this is destructive and needs confirmation
          const cap = bus.getCapability(toolCall.name);
          if (cap?.sideEffect === 'destructive') {
            const confirmed = await requestConfirmation(
              `The assistant wants to: ${cap.description}`,
              toolCall.arguments,
            );
            if (!confirmed) {
              const errorResult: InvocationResult = {
                status: 'error',
                requestId: toolCall.id,
                code: 'FORBIDDEN',
                message: 'User declined the action',
                timestamp: Date.now(),
              };
              display.result = errorResult;
              setToolCalls((prev) => [...prev.slice(0, -1), { ...display }]);
              return JSON.stringify(errorResult);
            }
          }

          const result = await bus.invoke(
            toolCall.name,
            toolCall.arguments,
            { type: 'agent', source: 'chat', triggeringMessage: userMessage },
          );
          display.result = result;
          setToolCalls((prev) => [...prev.slice(0, -1), { ...display }]);
          scrollToBottom();
          return JSON.stringify(result);
        },
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: response.text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      ]);
    } finally {
      setIsThinking(false);
      scrollToBottom();
    }
  }, [input, isThinking, bus, requestConfirmation, scrollToBottom]);

  return (
    <div className="chat-sidebar">
      <div className="chat-header">
        <span>AI Assistant</span>
        <span className="badge badge-mock">Mock</span>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {toolCalls.map((tc, i) => (
          <div key={`tc-${i}`} className="tool-call">
            <div className="tool-name">{tc.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {JSON.stringify(tc.args)}
            </div>
            {tc.result && (
              <div className={tc.result.status === 'success' ? 'tool-result' : 'tool-error'}>
                {tc.result.status === 'success' ? 'Success' : `Error: ${tc.result.status === 'error' ? tc.result.code : ''}`}
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="message system">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {confirmState.pending && confirmState.request && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Confirm Action</h3>
            <p>{confirmState.request.description}</p>
            <pre style={{ fontSize: 11, marginBottom: 16, overflow: 'auto', maxHeight: 100 }}>
              {JSON.stringify(confirmState.request.args, null, 2)}
            </pre>
            <div className="actions">
              <button className="btn-ghost" onClick={confirmState.deny}>
                Cancel
              </button>
              <button className="btn-primary" onClick={confirmState.confirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-input-area">
        <input
          type="text"
          placeholder="Ask the assistant..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isThinking}
        />
        <button className="btn-primary" onClick={handleSend} disabled={isThinking || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
