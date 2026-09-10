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

## 8. M2：Minimal Code Agent

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

M2 不再继续扩展 Agent Runtime 本身，而是让这个 Runtime 第一次拥有真正的 Coding 能力。

M2 最终需要完成一个最小闭环：

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

验收示例：

```text
用户：

修复 demo-project 中 add() 的实现，
并确保测试通过。
```

Agent 应能够自行完成：

```text
读取相关代码
→ 修改代码
→ 执行测试
→ 观察测试结果
→ 必要时继续修改
→ 最终结束
```

---

### 8.2 M2 必须实现的能力

#### 8.2.1 真实 ModelService

M1 使用：

```text
MockModel
```

M2 需要至少实现一个真实模型 Provider。

要求：

- 实现现有 `ModelService`
- 能将 `Context` 转换成模型 API 所需消息格式
- 能将 `AgentTool[]` 转换为模型可识别的 Tool Definition
- 能将模型返回的 Tool Call 转换为现有 `ToolCall`
- 不允许 Agent Loop 直接依赖具体模型 SDK

需要自行设计：

```text
真实 ModelService 应该放在哪个模块？

ModelService 与具体模型 Provider 的边界是什么？

API Key / modelName 应该由谁持有？

Provider 返回的数据在哪里转换成 AssistantMessage？

模型 API 错误如何处理？
```

我的设计：

```text
应该放在 Model.ts 这个文件中



```

---

#### 8.2.2 read_file Tool

能力：

```text
输入文件路径
→ 读取文件
→ 返回文本内容
```

需要自行设计：

```text
参数需要哪些字段？

如何验证参数？

文件不存在怎么办？

是否允许绝对路径？

Agent 能读取整个电脑，还是只能读取 workspace？

返回整个文件还是支持范围读取？
```

我的设计：

```text


```

---

#### 8.2.3 edit_file Tool

能力：

```text
Agent 指定代码修改
→ Tool 修改 Workspace 中的文件
```

需要自行设计：

```text
M2 使用哪种修改方式？

方案示例：

A. 整文件覆盖
B. oldText → newText
C. patch/diff
D. 其他方案

为什么选择这个方案？

如果目标文本不存在怎么办？

如果匹配多个位置怎么办？

是否允许创建新文件？

如何避免修改 workspace 之外的文件？
```

我的设计：

```text


```

---

#### 8.2.4 bash Tool

能力：

```text
command
→ 执行 shell command
→ stdout / stderr / exit code
→ ToolResult
```

主要用于：

```text
npm test
npm run build
git diff
grep
find
...
```

需要自行设计：

```text
参数是什么？

ToolResult 应该返回什么？

stdout / stderr 怎么组织？

exit code != 0：
属于 Tool 执行失败，
还是属于一次成功执行但命令结果失败？

命令是否允许任意执行？

工作目录如何确定？

M2 是否需要 timeout？
```

我的设计：

```text


```

---

### 8.3 Workspace 设计

M2 第一次开始操作真实文件，因此需要明确 Workspace 边界。

需要回答：

1. 什么是 Workspace？
2. `read_file` 如何知道当前 Workspace？
3. `edit_file` 如何知道当前 Workspace？
4. `bash` 默认在哪里执行？
5. `../` 是否允许逃出 Workspace？
6. Workspace 信息应该：
   - 作为 Tool 参数传入？
   - Tool 创建时绑定？
   - Agent Runtime 持有？
   - 其他方案？

我的设计：

```text


```

---

### 8.4 Tool Result 语义

M1 当前：

```ts
ToolResultMessage {
    type
    message
    toolCallId
    status
}
```

M2 需要重新验证它是否足够。

分别考虑：

#### read_file

```text
读取成功：

读取失败：
```

#### edit_file

```text
修改成功：

目标不存在：

文件不存在：
```

#### bash

```text
命令执行成功，exitCode = 0：

命令正常运行结束，但测试失败：

Shell 本身执行异常：
```

需要回答：

> Tool 的 `"error"` 究竟表示什么？

我的定义：

```text


```

---

### 8.5 Coding Agent 的 System Prompt

M1 没有真正需要 System Prompt。

M2 接入真实模型之后，需要考虑：

> 模型怎么知道自己是一个 Code Agent？

需要自行回答：

1. System Prompt 是否属于 Context？
2. 是否需要增加 `SystemMessage`？
3. 还是由具体 ModelService 单独接收 System Prompt？
4. System Prompt 最少应该告诉模型哪些规则？
5. Tool 描述和 System Prompt 的职责应该如何区分？

M2 不要求写复杂 Prompt。

目标只是解决：

```text
模型知道：
- 当前任务是什么
- 可以使用工具
- 应该先观察代码再修改
- 修改后应该验证
- 不应该假装执行过工具
```

我的设计：

```text


```

---

### 8.6 完整 M2 数据流

请自己画出类似下面的数据流，但不要直接照抄。

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

重点标出：

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

---

### 8.7 一个完整任务应该如何运行

目标任务：

```text
demo-project/src/math.ts

export function add(a: number, b: number) {
    return a - b;
}
```

已有测试：

```text
add(1, 2) should equal 3
```

用户：

```text
修复 add()，并确保测试通过。
```

请预测 Agent 应该如何执行。

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

#### Step 3

```text


```

最终：

```text


```

---

### 8.8 M2 的测试要求

M2 不只要求“看起来能跑”。

至少需要考虑：

#### Tool Unit Tests

```text
read_file：
- ?

edit_file：
- ?

bash：
- ?
```

#### Agent Integration Test

```text
输入一个有明确 Bug 的 fixture project

Agent
→ ?

最终检查：
→ ?
```

需要回答：

> 哪些测试应该继续使用 MockModel？

> 哪些测试必须使用真实 Model？

> 使用真实 Model 的测试是否应该成为普通 CI 测试？

我的设计：

```text


```

---

### 8.9 Fixture Project

M2 不应该一开始修改自己的 Agent 仓库。

建立独立的测试 Workspace，例如：

```text
fixtures/
└── broken-project/
```

要求：

- 项目非常小
- 有明确 Bug
- 有已有测试
- Bug 修复路径简单
- 可以重复恢复初始状态

需要设计：

```text
fixture 使用什么语言？

测试命令是什么？

Bug 是什么？

Agent 成功的客观标准是什么？

每次测试后如何恢复 fixture？
```

我的设计：

```text


```

---

### 8.10 M2 明确不做

逐项判断为什么延后：

| 能力 | M2 是否做 | 原因 |
|---|---|---|
| Plugin Architecture | 否 | |
| MCP | 否 | |
| Skill | 否 | |
| 多 Agent | 否 | |
| steering | 否 | |
| follow-up | 否 | |
| Context Compression | 否 | |
| Persistent Session | 否 | |
| 自动模型切换 | 否 | |
| RAG | 否 | |
| Vector DB | 否 | |
| Web UI | 否 | |
| Docker Sandbox | 否 | |
| Event Stream | 否 | |
| 自动 Retry | 否 | |
| Parallel Tool Call | 否 | |

如果你认为其中某项 M2 必须实现：

```text
能力：

为什么：
```

---

### 8.11 M2 是否需要修改 M1 Runtime

这是非常重要的一项。

完成前面的设计之后回答：

```text
为了支持 Code Agent，
我现有的 agentLoop 是否必须修改？
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

注意：

不要因为“代码看起来还能优化”就修改 M1。

只有 M2 的真实需求证明 M1 abstraction 不够时才修改。

---

### 8.12 M2 的最小架构

根据自己的设计填写：

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

不要提前为了“未来扩展”增加目录。

---

### 8.13 M2 的 Done Definition

只有满足以下条件，M2 才算完成。

#### Runtime

- M1 Agent Loop 仍然正常工作
- ToolCall / ToolResult 闭环没有被破坏

#### Model

- 已接入至少一个真实模型
- 模型能够主动选择工具
- ToolCall 能正确转换为现有内部类型

#### Coding Tools

- Agent 能读取 Workspace 文件
- Agent 能修改 Workspace 文件
- Agent 能执行测试命令

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

- Agent 不能修改测试 Workspace 之外的文件

#### Tests

- Coding Tools 有必要的单元测试
- M1 原有测试继续通过

---

### 8.14 M2 完成后我必须能解释的问题

完成 M2 后，我应该能够不用看答案解释：

1. 为什么 Agent Loop 不应该直接依赖 OpenAI / DeepSeek SDK？
2. Tool Definition 和 ToolCall 有什么区别？
3. 为什么 Tool Schema 是给模型看的，同时 Runtime 仍然需要参数校验？
4. 为什么 Code Agent 需要 Workspace boundary？
5. 为什么 `npm test` 返回失败不一定意味着 bash Tool 自身执行失败？
6. 为什么 ToolResult 必须重新进入 Context？
7. 为什么修改代码后应该通过工具验证，而不能相信模型说“已经修好了”？
8. MockModel Test 和 Real Model Integration Test 各自解决什么问题？
9. M1 Agent Runtime 为什么能够自然扩展成 Code Agent？
10. M2 中哪些部分属于确定性软件，哪些部分真正由 LLM 决策？

---

### 8.15 M2 核心设计原则

填写完上述问题之后，用自己的话总结：

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
