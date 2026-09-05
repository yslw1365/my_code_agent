export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;

export type Context = AgentMessage[];

export interface UserMessage {
  type: 'user';
  message: string;
}

export interface AssistantMessage {
  type: 'assistant';
  message: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
}

export interface ToolResultMessage {
  type: 'tool';
  message: string;
  toolCallId: string;
  status: 'success' | 'error';
}

export interface ModelService {
  modelName: string;
  apikey: string;
  call(context: Context, tools: AgentTool[]): Promise<AssistantMessage>;
}

export interface AgentTool {
  toolName: string;
  toolDesc: string;
  toolSchema: Record<string, unknown>;
  toolFunc: (args: Record<string, unknown>) => Promise<string>;
  validateArgs(args: Record<string, unknown>): boolean;
}

export interface ToolRegistry {
  register(tool: AgentTool): void;
  get(toolName: string): AgentTool | undefined;
  list(): AgentTool[];
}
