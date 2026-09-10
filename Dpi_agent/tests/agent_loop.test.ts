import { describe, expect, it, vi } from 'vitest';
import { runAgent } from '../src/agent_loop.js';
import { DefaultToolRegistry } from '../src/tool.js';
import type {
  AgentTool,
  AssistantMessage,
  Context,
  ModelService,
} from '../src/types.js';

function createModel(responses: AssistantMessage[]) {
  let responseIndex = 0;
  const contexts: Context[] = [];

  const model: ModelService = {
    modelName: 'test-model',
    apikey: 'test-key',
    async call(context, _tools) {
      contexts.push([...context]);

      const response = responses[responseIndex];
      responseIndex += 1;

      if (!response) {
        throw new Error('Test model ran out of responses');
      }

      return response;
    },
  };

  return { model, contexts };
}

function createRegistry(tools: AgentTool[] = []) {
  const registry = new DefaultToolRegistry();

  for (const tool of tools) {
    registry.register(tool);
  }

  return registry;
}

describe('runAgent', () => {
  it('executes one ToolCall and finishes after the second model call', async () => {
    const toolFunc = vi.fn(async (args: Record<string, unknown>) => {
      return `received ${args.query}`;
    });
    const tool: AgentTool = {
      toolName: 'search-tool',
      toolDesc: 'A search tool for the test',
      toolSchema: {},
      toolFunc,
      validateArgs: (args) => typeof args.query === 'string',
    };
    const userMessage = { type: 'user' as const, message: 'search AI' };
    const firstAssistantMessage: AssistantMessage = {
      type: 'assistant',
      message: 'I will search',
      toolCalls: [
        {
          toolCallId: 'call-1',
          toolName: 'search-tool',
          toolArgs: { query: 'AI' },
        },
      ],
    };
    const finalAssistantMessage: AssistantMessage = {
      type: 'assistant',
      message: 'Task complete',
    };
    const { model, contexts } = createModel([
      firstAssistantMessage,
      finalAssistantMessage,
    ]);

    const result = await runAgent(
      userMessage,
      model,
      createRegistry([tool]),
    );

    expect(result).toEqual(finalAssistantMessage);
    expect(toolFunc).toHaveBeenCalledWith({ query: 'AI' });
    expect(contexts).toHaveLength(2);
    expect(contexts[1]).toContainEqual({
      type: 'tool',
      message: 'received AI',
      toolCallId: 'call-1',
      status: 'success',
    });
  });

  it('creates an error ToolResult when the Tool does not exist', async () => {
    const userMessage = { type: 'user' as const, message: 'use missing tool' };
    const firstAssistantMessage: AssistantMessage = {
      type: 'assistant',
      message: 'I will use a missing tool',
      toolCalls: [
        {
          toolCallId: 'missing-call',
          toolName: 'missing-tool',
          toolArgs: {},
        },
      ],
    };
    const { model, contexts } = createModel([
      firstAssistantMessage,
      { type: 'assistant', message: 'I handled the missing tool' },
    ]);

    await runAgent(userMessage, model, createRegistry());

    expect(contexts[1]).toContainEqual({
      type: 'tool',
      message: 'Tool missing-tool not found',
      toolCallId: 'missing-call',
      status: 'error',
    });
  });

  it('creates an error ToolResult when Tool arguments are invalid', async () => {
    const toolFunc = vi.fn(async () => 'should not run');
    const tool: AgentTool = {
      toolName: 'validated-tool',
      toolDesc: 'A tool with invalid arguments',
      toolSchema: {},
      toolFunc,
      validateArgs: () => false,
    };
    const userMessage = { type: 'user' as const, message: 'use invalid args' };
    const firstAssistantMessage: AssistantMessage = {
      type: 'assistant',
      message: 'I will use invalid args',
      toolCalls: [
        {
          toolCallId: 'invalid-call',
          toolName: 'validated-tool',
          toolArgs: { value: 'bad' },
        },
      ],
    };
    const { model, contexts } = createModel([
      firstAssistantMessage,
      { type: 'assistant', message: 'I handled invalid args' },
    ]);

    await runAgent(userMessage, model, createRegistry([tool]));

    expect(toolFunc).not.toHaveBeenCalled();
    expect(contexts[1]).toContainEqual({
      type: 'tool',
      message: 'Tool validated-tool received invalid arguments',
      toolCallId: 'invalid-call',
      status: 'error',
    });
  });

  it('creates an error ToolResult when Tool execution throws', async () => {
    const tool: AgentTool = {
      toolName: 'throw-tool',
      toolDesc: 'A tool that throws',
      toolSchema: {},
      toolFunc: async () => {
        throw new Error('tool failed');
      },
      validateArgs: () => true,
    };
    const userMessage = { type: 'user' as const, message: 'use throwing tool' };
    const firstAssistantMessage: AssistantMessage = {
      type: 'assistant',
      message: 'I will use a throwing tool',
      toolCalls: [
        {
          toolCallId: 'throw-call',
          toolName: 'throw-tool',
          toolArgs: {},
        },
      ],
    };
    const { model, contexts } = createModel([
      firstAssistantMessage,
      { type: 'assistant', message: 'I handled the tool failure' },
    ]);

    await runAgent(userMessage, model, createRegistry([tool]));

    expect(contexts[1]).toContainEqual({
      type: 'tool',
      message: 'Tool throw-tool failed: tool failed',
      toolCallId: 'throw-call',
      status: 'error',
    });
  });
});
