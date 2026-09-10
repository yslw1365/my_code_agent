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
- Agent Loop：M1 已实现，待补充剩余验证测试
- Tool Executor：M1 已实现

## 6. 设计决定与待确认假设

下表只把已经明确或当前代码已经采用的内容标为决定；其余内容需要后续 Review。

| 内容 | 状态 | 说明 |
|---|---|---|
| 第一版使用 TypeScript | 当前采用 | 与 Pi 学习路径和 Code Agent 方向保持一致 |
| 第一版使用单层循环 | 当前设计 | M1 只实现单层 Agent Loop |
| 第一版顺序执行 Tool | 当前设计 | 多个 Tool Call 按顺序执行，前一个失败不影响后续 Tool |
| 设置最大循环次数 | 当前设计 | `MAX_STEPS = 8`，防止无限循环 |
| 工具错误转换为 Tool Result | 当前设计 | 让模型看到可处理的错误，而不是直接丢失循环上下文 |
| 暂不实现复杂事件流 | 已确认延后 | 当前目标是先跑通核心数据流 |

## 7. M1 Agent Loop 完整设计

```text
输入：
UserMessage
ModelService
ToolRegistry
maxSteps

输出：
Promise<AssistantMessage>

Context：
[UserMessage]

每个 Step：
1. model.call(context, registry.list())
2. AssistantMessage 加入 Context
3. 无 toolCalls → return AssistantMessage
4. 有 toolCalls：
   - 顺序遍历全部 ToolCall
   - 查找 Tool
   - validateArgs
   - toolFunc
   - success/error → ToolResultMessage
   - ToolResultMessage 加入 Context
5. 全部 ToolCall 处理完 → 下一 Step

Tool 错误：
转为 status:error 的 ToolResultMessage，不终止 Agent

Model 错误：
抛出错误，终止 Runtime

MAX_STEPS：
抛出错误，终止 Runtime
```

设计目标：

- M1 只实现最小、单层的 Agent Loop。
- `Context` 保存模型与工具之间的消息流；`tools` 通过 `ModelService.call()` 单独传入，不混入 `Context`。
- Agent Loop 只根据结构化的 `AssistantMessage.toolCalls` 控制流程，不解析自然语言。
- Tool 错误写回 Context，让模型有机会基于错误结果继续处理；模型调用错误和最大步数错误终止 Runtime。
- 当前不实现事件流、重试、Context 压缩、Context 暂存、持久化或其他后续能力。

### 设计验收

- [ ] 能画出一轮模型调用、Tool 执行和 Context 更新的数据流
- [ ] 能解释模型决定“调用什么”和运行时决定“如何继续”的区别
- [ ] 能说明每个错误分支如何影响 Context
- [ ] 能说明 `MAX_STEPS` 的作用
- [ ] 能用当前 `types.ts` 的接口表达自己的设计

## 8. M2：Minimal Code Agent 设计（待填写）

> 本节用于独立设计 M2。下面的目标、能力和问题来自阶段建议，暂不视为项目负责人的最终设计决定。

### 8.1 M2 的目标

M1 已经解决：

```text
User
→ Model
→ ToolCall
→ Tool Execution
→ ToolResult
→ Model
→ Final Answer
```

M2 的候选目标是让现有 Runtime 第一次具备最小的 Coding 能力：

```text
用户提出代码修改任务
        ↓
Agent 理解任务
        ↓
读取代码
        ↓
修改代码
        ↓
运行测试
        ↓
根据测试结果决定是否继续
        ↓
测试通过
        ↓
返回最终结果
```

验收任务示例：

```text
修复 demo-project 中 add() 的实现，并确保测试通过。
```

我的 M2 目标：

```text

```

### 8.2 M2 需要增加的能力

以下内容是待设计的候选能力，不代表已经决定采用。

#### 真实 ModelService

M1 使用 `MockModel`。M2 是否接入真实模型，以及如何实现，需要回答：

```text
真实 ModelService 应该放在哪个模块？

ModelService 与具体模型 Provider 的边界是什么？

API Key / modelName 应该由谁持有？

Provider 返回的数据在哪里转换成 AssistantMessage？

模型 API 错误如何处理？
```

我的设计：

```text

```

#### `read_file` Tool

候选流程：

```text
输入文件路径
→ 读取文件
→ 返回文本内容
```

需要回答：

```text
参数需要哪些字段？

如何验证参数？

文件不存在怎么办？

是否允许绝对路径？

Agent 能读取整个电脑，还是只能读取 Workspace？

返回整个文件，还是支持范围读取？
```

我的设计：

```text

```

#### `edit_file` Tool

候选流程：

```text
Agent 指定代码修改
→ Tool 修改 Workspace 中的文件
```

需要回答：

```text
M2 使用哪种修改方式？

A. 整文件覆盖
B. oldText → newText
C. patch/diff
D. 其他方案

为什么选择这个方案？

如果目标文本不存在怎么办？

如果匹配多个位置怎么办？

是否允许创建新文件？

如何避免修改 Workspace 之外的文件？
```

我的设计：

```text

```

#### `bash` Tool

候选流程：

```text
command
→ 执行 shell command
→ stdout / stderr / exit code
→ ToolResult
```

需要回答：

```text
参数是什么？

ToolResult 应该返回什么？

stdout / stderr 怎么组织？

exit code != 0：
属于 Tool 执行失败，还是属于命令成功执行但命令结果失败？

命令是否允许任意执行？

工作目录如何确定？

M2 是否需要 timeout？
```

我的设计：

```text

```

### 8.3 Workspace 设计

M2 第一次操作真实文件，因此需要明确 Workspace 边界：

```text
什么是 Workspace？

read_file 如何知道当前 Workspace？

edit_file 如何知道当前 Workspace？

bash 默认在哪里执行？

../ 是否允许逃出 Workspace？

Workspace 信息应该作为 Tool 参数传入、在 Tool 创建时绑定，还是由 Agent Runtime 持有？
```

我的设计：

```text

```

### 8.4 ToolResult 语义

M1 使用：

```ts
ToolResultMessage {
  type
  message
  toolCallId
  status
}
```

M2 需要重新验证它是否足够表达不同 Tool 的结果。

需要分别考虑：

```text
read_file：读取成功、读取失败

edit_file：修改成功、目标不存在、文件不存在

bash：命令执行成功、命令运行但测试失败、Shell 执行异常
```

我的定义：

```text

```

### 8.5 Coding Agent 的 System Prompt

需要回答：

```text
System Prompt 是否属于 Context？

是否需要增加 SystemMessage？

还是由具体 ModelService 单独接收 System Prompt？

System Prompt 最少应该告诉模型哪些规则？

Tool 描述和 System Prompt 的职责如何区分？
```

M2 的 Prompt 目标暂时只围绕：

```text
模型知道当前任务是什么；
模型知道可以使用工具；
模型应该先观察代码再修改；
模型修改后应该验证；
模型不应该假装执行过工具。
```

我的设计：

```text

```

### 8.6 M2 数据流

请用自己的设计补全：

```text
User
 ↓

???

 ↓

Real Model

 ↓

???

 ↓

Tool

 ↓

???

 ↓

Model

 ↓

Final Answer
```

需要标出：

```text
Context
ToolRegistry
ModelService
Workspace
read_file
edit_file
bash
```

我的设计：

```text

```

### 8.7 一个完整任务如何运行

目标 Fixture：

```ts
export function add(a: number, b: number) {
  return a - b;
}
```

已有测试要求：

```text
add(1, 2) should equal 3
```

用户输入：

```text
修复 add()，并确保测试通过。
```

请预测 Agent 如何执行：

#### Step 1

模型看到：

```text

```

模型决定：

```text

```

#### Tool Result

```text

```

#### Step 2

模型看到：

```text

```

模型决定：

```text

```

#### 最终结果

```text

```

### 8.8 M2 测试设计

#### Tool Unit Tests

```text
read_file：
-

edit_file：
-

bash：
-
```

#### Agent Integration Test

```text
输入一个有明确 Bug 的 Fixture Project

Agent
→

最终检查：
→
```

需要回答：

```text
哪些测试继续使用 MockModel？

哪些测试必须使用真实 Model？

使用真实 Model 的测试是否应该成为普通 CI 测试？
```

我的设计：

```text

```

### 8.9 Fixture Project

M2 不应一开始修改自己的 Agent 仓库。候选结构：

```text
fixtures/
└── broken-project/
```

需要设计：

```text
Fixture 使用什么语言？

测试命令是什么？

Bug 是什么？

Agent 成功的客观标准是什么？

每次测试后如何恢复 Fixture？
```

我的设计：

```text

```

### 8.10 M2 明确不做的能力

以下是待确认的候选延后项，不是已经确认的决定：

| 能力 | M2 是否做 | 原因 |
|---|---|---|
| Plugin Architecture |  |  |
| MCP |  |  |
| Skill |  |  |
| 多 Agent |  |  |
| steering |  |  |
| follow-up |  |  |
| Context Compression |  |  |
| Persistent Session |  |  |
| 自动模型切换 |  |  |
| RAG |  |  |
| Vector DB |  |  |
| Web UI |  |  |
| Docker Sandbox |  |  |
| Event Stream |  |  |
| 自动 Retry |  |  |
| Parallel Tool Call |  |  |

我的补充：

```text

```

### 8.11 是否需要修改 M1 Runtime

这是 M2 的关键设计问题：

```text
为了支持 Code Agent，现有 agentLoop 是否必须修改？
```

如果需要：

```text
必须修改什么？

为什么？
```

如果不需要：

```text
为什么 M1 Runtime 已经可以支持 Coding？
```

我的设计：

```text

```

### 8.12 M2 最小架构

根据自己的设计填写，不要为了未来扩展提前增加目录：

```text
src/

agent_loop.ts
    └── ?

model.ts
    └── ?

tool.ts
    └── ?

types.ts
    └── ?

???

fixtures/
    └── broken-project

tests/
    └── ?
```

我的设计：

```text

```

### 8.13 M2 Done Definition

只有满足以下条件，M2 才算完成：

#### Runtime

- M1 Agent Loop 仍然正常工作。
- ToolCall / ToolResult 闭环没有被破坏。

#### Model

- 已接入至少一个真实模型。
- 模型能够主动选择工具。
- ToolCall 能正确转换为现有内部类型。

#### Coding Tools

- Agent 能读取 Workspace 文件。
- Agent 能修改 Workspace 文件。
- Agent 能执行测试命令。

#### End-to-End

对于一个之前没有见过的简单 Bug：

```text
User Prompt
    ↓
Agent
    ↓
读取代码
    ↓
修改代码
    ↓
运行测试
    ↓
最终测试通过
    ↓
Agent 返回完成结果
```

能够真实跑通。

#### Safety

- Agent 不能修改测试 Workspace 之外的文件。

#### Tests

- Coding Tools 有必要的单元测试。
- M1 原有测试继续通过。

我的 M2 Done Definition：

```text

```

### 8.14 M2 完成后我必须能解释的问题

1. 为什么 Agent Loop 不应该直接依赖具体模型 SDK？
2. Tool Definition 和 ToolCall 有什么区别？
3. 为什么 Tool Schema 是给模型看的，同时 Runtime 仍然需要参数校验？
4. 为什么 Code Agent 需要 Workspace Boundary？
5. 为什么测试命令返回失败不一定意味着 bash Tool 自身执行失败？
6. 为什么 ToolResult 必须重新进入 Context？
7. 为什么修改代码后应该通过 Tool 验证，而不能相信模型说“已经修好了”？
8. MockModel Test 和 Real Model Integration Test 各自解决什么问题？
9. M1 Agent Runtime 为什么能够扩展成 Code Agent？
10. M2 中哪些部分属于确定性软件，哪些部分真正由 LLM 决策？

我的回答：

```text

```

### 8.15 M2 核心设计原则

```text
M2 的核心目标：

M2 相比 M1 增加了什么：

M2 刻意没有增加什么：

LLM 负责：

确定性代码负责：

我认为当前架构最大的限制：

下一阶段可能需要解决的问题：
```

## 9. 后续演进，仅作路线记录

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
