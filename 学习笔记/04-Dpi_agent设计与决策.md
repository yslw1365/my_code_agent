# Dpi_agent 设计与决策

> 本文记录从对话中形成的项目目标、设计原则和阶段边界。
>
> 记录时区分：明确决定、当前采用、待确认假设。不要把 GPT 的建议直接当成自己的设计决定。

## 1. 记录来源

- 主要来源：[新工作准备](https://chatgpt.com/share/6a966367-fa30-83ee-8a34-a5fecc7cd55b)
- 相关学习笔记：[[00-学习地图]]、[[03-Agent-Loop]]
- 当前实现目录：`Dpi_agent/`

## 2. 项目目标

### 已确认

- 本项目的目标不只是完成代码，还要通过实现、Review、测试和复盘掌握 Agent Engineering。
- 项目负责人负责需求、语义、架构、Review 和验收。
- Codex 负责依据已确认设计实现代码、补测试、解释实现和处理机械性工程工作。
- 采用 `Design first → Implementation → Review → Test → Refactor` 工作方式。
- 架构不需要一次性设计完整；先形成足够清晰的最小假设，再通过实现和反馈迭代。

### 当前采用

- 使用 TypeScript 作为主语言，以便和正在学习的 Pi Agent 形成知识迁移。
- 先实现自己的最小 Code Agent，不直接依赖 LangGraph、CrewAI 或 AutoGen。
- 当前 `my_code_agent` 聚焦通用 Code Agent 核心，不实现 Douyin、Playwright 或具体业务工具。

## 3. 设计原则

### 已确认

- 采用 Just-enough Architecture：只设计当前需求明确需要的部分。
- 模型负责理解目标并提出行动请求；运行时负责校验、执行、写回 Context 和调度下一轮。
- Tool 是稳定的能力边界，不等同于简单暴露一个普通函数。
- 确定性的遍历、状态更新和错误处理，不应全部交给模型决定。
- 先跑通最小链路，再根据真实问题引入 State、checkpoint、审批等能力。

### 边界

Agent Loop 不应直接依赖具体模型供应商的 API Key、SDK 或 URL；模型接入细节属于 Model / Provider 层。

当前项目暂不实现：

- steering、follow-up 和复杂事件流
- 并行 Tool Call
- 动态模型或 reasoning 切换
- 自动 retry / continue
- Persistent Session、数据库和长期记忆
- MCP、多 Agent 和复杂框架

## 4. 已独立完成的基础设计

> 本节记录当前 `src/` 下三个核心文件中的设计。核心接口、数据结构和 Mock 行为来自项目负责人独立编写的代码；此前只对 import 扩展名做过 NodeNext 兼容性修复。

### 4.1 `types.ts`：消息、Context、Tool 和模型接口

#### 消息模型

```ts
export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;
export type Context = AgentMessage[];
```

当前设计用一个联合类型表示 Agent 运行过程中可能出现的三类消息：

| 类型 | 作用 | 关键字段 |
|---|---|---|
| `UserMessage` | 用户输入 | `type: 'user'`、`message` |
| `AssistantMessage` | 模型回复或工具调用请求 | `type: 'assistant'`、`message`、可选 `toolCalls` |
| `ToolResultMessage` | Tool 执行后的结果 | `type: 'tool'`、`message`、`toolCallId`、`status` |

`Context` 当前就是 `AgentMessage[]`。这意味着模型下一轮调用所需的历史事实，先以统一消息序列保存。

#### Tool Call

```ts
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
}
```

`ToolCall` 表示模型提出的一次工具调用请求：

- `toolCallId` 用于把执行结果对应回这次调用。
- `toolName` 用于从 Registry 查找 Tool。
- `toolArgs` 使用 `Record<string, unknown>`，表示运行时参数需要进一步校验，不能直接假设类型正确。

#### ModelService

```ts
export interface ModelService {
  modelName: string;
  apikey: string;
  call(context: Context, tools: AgentTool[]): Promise<AssistantMessage>;
}
```

当前模型层只向 Agent Runtime 暴露一个异步 `call` 接口。Runtime 提供当前 `Context` 和可用 `AgentTool[]`，模型返回一个 `AssistantMessage`。

API Key 字段目前保留在模型服务接口中；具体 Provider、SDK 和真实网络调用尚未实现。

#### AgentTool

```ts
export interface AgentTool {
  toolName: string;
  toolDesc: string;
  toolSchema: Record<string, unknown>;
  toolFunc: (args: Record<string, unknown>) => Promise<string>;
  validateArgs(args: Record<string, unknown>): boolean;
}
```

一个 Tool 当前包含五部分：

- 名称：供模型请求和 Registry 查找。
- 描述：供模型理解能力用途。
- Schema：描述参数结构，当前还没有接入具体 Schema 校验库。
- 异步执行函数：接收参数并返回字符串结果。
- 参数校验函数：在执行前判断参数是否符合要求。

这里已经把“模型看到的 Tool 信息”和“运行时实际执行的函数”放在同一个 `AgentTool` 接口中，但真正如何把 Schema 传给模型、如何调用校验和执行，留给 Agent Loop / Tool Executor 完成。

#### ToolRegistry

```ts
export interface ToolRegistry {
  register(tool: AgentTool): void;
  get(toolName: string): AgentTool | undefined;
  list(): AgentTool[];
}
```

Registry 只定义三个能力：注册、按名称获取、列出全部 Tool。它不负责执行 Tool，也不负责 Agent Loop 控制。

### 4.2 `tool.ts`：基于 Map 的默认 Registry

```ts
export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<string, AgentTool>();
}
```

当前实现的行为：

| 方法 | 当前行为 |
|---|---|
| `register(tool)` | 以 `tool.toolName` 为 key 写入 Map；同名 Tool 会被后注册的覆盖 |
| `get(toolName)` | 返回对应 Tool；不存在时返回 `undefined` |
| `list()` | 将 Map 中的所有 Tool 转成数组 |

这个实现保持了一个很小的职责边界：Registry 只管理 Tool 的索引，不主动校验参数、不执行函数、不决定是否继续循环。

### 4.3 `model.ts`：用于验证循环的 MockModel

`MockModel` 实现 `ModelService`，当前不是实际模型 Provider，而是一个确定性的测试替身。

初始化状态：

```text
modelName = "mock-model"
apikey = "mock-key"
callCount = 0
```

调用行为：

1. 每次 `call()` 先将 `callCount` 加一。
2. 第一次调用时，取 `tools[0]`。
3. 如果存在第一个 Tool，就返回针对该 Tool 的 `ToolCall`，参数暂时为空对象 `{}`。
4. 如果没有 Tool，就返回名称为 `no-tool` 的 Tool Call，便于后续测试未知 Tool 分支。
5. 第二次及之后调用不再返回 `toolCalls`，而是返回“任务完成”的 Assistant Message。

因此它人为构造了一个最小的两轮路径：

```text
第一次模型调用 → 返回 ToolCall
       ↓
运行时执行 Tool 并写回 ToolResult
       ↓
第二次模型调用 → 不返回 ToolCall，结束
```

当前 `context` 参数尚未被 MockModel 使用，这是测试替身的简化行为；真正的 Agent Loop 需要保证 Tool Result 已写回 Context 后再将 Context 传入下一轮模型调用。

### 4.4 当前设计已经覆盖与尚未覆盖的边界

当前三个文件已经表达了：

- 消息的基本类型
- Context 的容器形式
- Tool Call 的请求数据
- Tool Result 的成功/错误状态
- Model 与 Tool 的异步接口
- Tool Registry 的索引行为
- 一个可预测的两轮模型响应

当前尚未表达或实现：

- Agent Loop 控制流
- Tool Executor
- Tool 参数校验的调用时机
- Tool 执行异常如何转换成 `ToolResultMessage`
- Tool Result 如何写回 Context
- 最大步数如何终止循环

这些属于下一步 `agent-loop` 设计和实现，不应由本节替你补充结论。

## 5. 第一版 M1：工具化 Agent Loop

### 已确认的目标

第一版要跑通以下链路：

```text
User Message
  ↓
Context
  ↓
ModelService
  ↓
AssistantMessage / ToolCall
  ↓
ToolRegistry
  ↓
Tool 执行
  ↓
ToolResultMessage
  ↓
Context
  ↓
下一轮模型调用或最终回答
```

第一版需要支持：

- Context 和消息管理
- 一次模型调用
- 识别 Tool Call
- Tool Registry
- 参数校验
- 顺序执行 Tool
- Tool Result 写回 Context
- 没有 Tool Call 时结束
- 最大循环次数
- 未知 Tool、参数错误和执行异常的基础错误结果

当前设计记录为 `MAX_STEPS = 8`。

### 当前本地映射

- 消息和接口：`Dpi_agent/src/types.ts`
- Tool Registry：`Dpi_agent/src/tool.ts`
- Mock Model：`Dpi_agent/src/model.ts`
- Agent Loop：尚未实现
- Tool Executor：尚未实现

## 6. 设计决定与待确认假设

下表只把已经明确或当前代码已经采用的内容标为决定；其余内容需要后续 Review。

| 内容 | 状态 | 说明 |
|---|---|---|
| 第一版使用 TypeScript | 当前采用 | 与 Pi 学习路径和 Code Agent 方向保持一致 |
| 第一版使用单层循环 | 待确认 | 可先降低复杂度，后续再考虑 steering/follow-up |
| 第一版顺序执行 Tool | 待确认 | 先保证数据流清晰，暂不处理并发语义 |
| 设置最大循环次数 | 当前设计 | 暂定 `MAX_STEPS = 8`，防止无限循环 |
| 工具错误转换为 Tool Result | 当前设计 | 让模型看到可处理的错误，而不是直接丢失循环上下文 |
| 暂不实现复杂事件流 | 已确认延后 | 当前目标是先跑通核心数据流 |

## 7. 当前需要独立完成：agent-loop 设计

在让 Codex 实现 `agent-loop.ts` 之前，先独立回答下面的问题。这里故意不填写答案。

1. `agentLoop` 接收哪些参数，返回什么结果？
2. 初始 `Context` 如何创建？是否由调用方传入？
3. 每轮模型返回后，哪些消息要追加到 Context？顺序是什么？
4. 如何判断 AssistantMessage 中是否存在 Tool Call？
5. Tool 不存在、参数无效、Tool 执行失败时，分别追加什么 Tool Result？
6. 多个 Tool Call 是否顺序执行？如果前一个失败，后面的是否继续？
7. 没有 Tool Call 时，Agent 返回什么？Context 是否需要一并返回？
8. 超过 `MAX_STEPS` 时，Agent 返回什么错误？已经产生的 Context 如何处理？
9. `ModelService.call()` 抛出异常时，循环如何结束？
10. Tool Executor 的职责放在 `agentLoop` 内，还是单独抽出函数？为什么？

### 我的设计草稿

```text
函数签名：

初始 Context：

每轮流程：

继续条件：

结束条件：

Tool 错误处理：

最大步数处理：

我选择这些方案的原因：
```

### 设计验收

- [ ] 能画出一轮模型调用、Tool 执行和 Context 更新的数据流
- [ ] 能解释模型决定“调用什么”和运行时决定“如何继续”的区别
- [ ] 能说明每个错误分支如何影响 Context
- [ ] 能说明 `MAX_STEPS` 的作用
- [ ] 能用当前 `types.ts` 的接口表达自己的设计

## 8. 后续演进，仅作路线记录

这些不是当前任务：

```text
M1：Agent Loop + Tool Registry + Tool Result
  ↓
后续：State / SQLite
  ↓
再后续：Human-in-the-loop + Approval
  ↓
再后续：Checkpoint + 长任务恢复 + Evals
  ↓
最后再评估：MCP 或其他扩展
```

每次引入新层前，都要记录：遇到了什么真实问题、为什么现有设计不够、有哪些备选方案、最终为什么选择该方案。
