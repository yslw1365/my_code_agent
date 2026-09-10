import { UserMessage, ModelService, ToolRegistry, ToolResultMessage, AssistantMessage, Context, ToolCall } from "./types.js";

export async function runAgent(
    usermessage: UserMessage,
    model: ModelService,
    toolregistry: ToolRegistry,
    maxSteps = 8,
): Promise<AssistantMessage> {
    // 创建 Context
    const context: Context = [usermessage];
    // for maxSteps
    for (let step = 0; step < maxSteps; step++) {

        // 调 Model
        const assistantMessage = await model.call(
            context,
            toolregistry.list()
        );
        // AssistantMessage → Context
        context.push(assistantMessage);

        // 没有 ToolCall → return
        if (!assistantMessage.toolCalls || assistantMessage.toolCalls.length === 0) {
            return assistantMessage;
        }
        // 遍历 ToolCalls
        for (const toolCall of assistantMessage.toolCalls) {
            // executeToolCall()
            const toolresult = await executeToolCall(toolCall, toolregistry);
            // ToolResult → Context
            context.push(toolresult);
        }
    }
    // maxSteps error
    throw new Error(`Max steps (${maxSteps}) reached without completing the task.`);
}

async function executeToolCall(
    toolCall: ToolCall,
    toolRegistry: ToolRegistry
): Promise<ToolResultMessage> {
    const tool = toolRegistry.get(toolCall.toolName);

    if (!tool) {
        return {
            type: 'tool',
            message: `Tool ${toolCall.toolName} not found`,
            toolCallId: toolCall.toolCallId,
            status: 'error',
        };
    }

    const isValidArgs = tool.validateArgs(toolCall.toolArgs);
    if (!isValidArgs) {
        return {
            type: 'tool',
            message: `Tool ${toolCall.toolName} received invalid arguments`,
            toolCallId: toolCall.toolCallId,
            status: 'error',
        };
    }

    try {
        const result = await tool.toolFunc(toolCall.toolArgs);

        return {
            type: 'tool',
            message: result,
            toolCallId: toolCall.toolCallId,
            status: 'success',
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return {
            type: 'tool',
            message: `Tool ${toolCall.toolName} failed: ${message}`,
            toolCallId: toolCall.toolCallId,
            status: 'error',
        };
    }
}
