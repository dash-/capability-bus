import type { ToolDefinition } from '@capability-bus/core';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentResponse {
  text: string;
}

export interface AgentService {
  chat(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>,
    onTextChunk?: (chunk: string) => void,
  ): Promise<AgentResponse>;
}
