import {
  AgentTool,
  AssistantMessage,
  Context,
  ModelService,
  ToolCall,
} from './types.js';

export class MockModel implements ModelService {
  modelName: string;
  apikey: string;
  private callCount = 0;

  constructor() {
    this.modelName = 'mock-model';
    this.apikey = 'mock-key';
  }

  async call(context: Context, tools: AgentTool[]): Promise<AssistantMessage> {
    this.callCount += 1;

    if (this.callCount === 1) {
      const firstTool = tools[0];
      const toolCall: ToolCall = firstTool
        ? { toolCallId: 'mock-call-1', toolName: firstTool.toolName, toolArgs: {} }
        : { toolCallId: 'mock-call-1', toolName: 'no-tool', toolArgs: {} };

      return {
        type: 'assistant',
        message: 'mock 第一次调用，请执行工具调用',
        toolCalls: [toolCall],
      };
    }

    return {
      type: 'assistant',
      message: 'mock 第二次调用，任务完成',
    };
  }
}
