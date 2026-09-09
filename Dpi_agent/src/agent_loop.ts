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
    toolcall: ToolCall,
    toolregistry: ToolRegistry
): Promise<ToolResultMessage> {
    // 找到对应 Tool
    const tool = toolregistry.get(toolcall.toolName)
    if (!tool) {
        return {
            type: 'tool',
            message: `Tool ${toolcall.toolName} not found`,
            toolCallId: toolcall.toolCallId,
            status: 'error',
        }
    }
    // 校验参数
    tool.validateArgs(toolcall.toolArgs)
    // 校验失败，返回失败，当前缺少判断逻辑
    return {
        type: 'tool',
        message: `Tool ${toolcall.toolArgs} is invaild`,
        toolCallId: toolcall.toolCallId,
        status: 'error',
    }
    // 执行 Tool
    const result = await tool.toolFunc(toolcall.toolArgs);
    // 结果包装为ToolResultMessage
    return {
        type: 'tool',
        message: result,
        toolCallId: toolcall.toolCallId,
        status: "success",
    }
    // 工具异常，给一个错误的 result 信息
}