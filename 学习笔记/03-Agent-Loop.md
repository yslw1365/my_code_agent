# Agent Loop

> 本笔记是一份源码学习工作表。先独立阅读和填写，再把“猜测”升级为有源码或实验支持的“事实”。

## 学习状态

- 状态：学习中
- 开始日期：2026-08-13
- 最近更新：2026-08-13
- 关联学习地图：[[00-学习地图]]
- 参考项目：Pi
- 参考版本或 commit：`853a80d26`
- 主要源码：`pi/packages/agent/src/agent-loop.ts`

## 0. 本轮学习目标

这次只需要回答四个核心问题：

1. Agent Loop 的主循环位于哪个函数？
2. 模型返回的 tool call 在哪里被读取？
3. 有 tool call 时，什么条件让模型再运行一轮？
4. 没有 tool call 时，循环如何结束？

完成以上问题后，再继续追踪 tool result 如何进入下一轮 context。暂时不要深入每个 Tool 的内部实现。

---

## 1. 要解决的问题

### 阅读前思考

1. 普通聊天程序只调用一次模型。为什么 Code Agent 不能只调用一次？
   - 我的回答：我知道经典code agent用React模式来实现写代码，React模式需要在模型输出内容之后去比对最初的需求，根据需求是否实现，然后决定下一步的行动，所以这样的话就需要调很多次。

2. 当模型返回 tool call 而不是最终答案时，运行时还需要完成哪些工作？
   - 我的回答返回tool的运行结果给模型，模型判断结果是否符合预期，然后进行下一步行动。

3. 谁负责决定是否再次调用模型：用户、Tool、Agent Loop，还是模型本身？这里的“决定”分别由哪些信号共同产生？
   - 我的回答：Agent loop。我不知道这个信号是什么

4. 如果没有 Agent Loop，一个“读取文件并总结”的请求会在哪里中断？
   - 我的回答：不知道，感觉是读取文件，调用read工具后就中断了？

### 学习后总结

用 2～4 句话解释 Agent Loop 要解决的问题：

> 待填写。

---

## 2. 最小心智模型

### 填空

请根据源码补全：

```text
用户消息
→ 加入 __________
→ 调用 __________
→ 得到 assistant message
→ 检查 __________
→ 若存在：执行工具
→ 将 __________ 加入 __________
→ 再次调用模型
→ 若不存在：__________
```

### 用自己的话画一遍

不要复制上面的流程，脱离源码重新画一张：

```text
待填写
```

### 判断题

- [ ] Agent Loop 自己生成最终答案。
- [ ] Agent Loop 负责在模型和 Tool 之间调度。
- [ ] Tool 执行结束就一定代表整个 Agent 结束。
- [ ] 模型的一次响应等同于 Agent 的一次完整运行。

订正与原因：

> 待填写。

---

## 3. 输入、输出与状态

重点阅读：

- `agentLoop(...)`
- `agentLoopContinue(...)`
- `runAgentLoop(...)`
- `runAgentLoopContinue(...)`
- `runLoop(...)`
- `types.ts` 中与上述函数参数对应的类型

### 3.1 入口函数对比

| 问题 | `agentLoop` | `agentLoopContinue` |
|---|---|---|
| 使用场景是什么？ | 待填写 | 待填写 |
| 是否接收新的 prompts？ | 待填写 | 待填写 |
| 对已有 context 有什么要求？ | 待填写 | 待填写 |
| 返回什么？ | 待填写 | 待填写 |
| 最终调用哪个共享主循环？ | 待填写 | 待填写 |

思考：为什么“开始一轮”和“从现有 context 继续”需要两个入口，但可以共享一个主循环？

> 待填写。

### 3.2 `runLoop` 的输入

逐项填写，不只翻译变量名，要说明它在循环中的实际用途。

| 参数 | 类型 | 谁提供 | 在循环中的用途 |
|---|---|---|---|
| `initialContext` |  |  |  |
| `newMessages` |  |  |  |
| `initialConfig` |  |  |  |
| `signal` |  |  |  |
| `emit` |  |  |  |
| `streamFunction` |  |  |  |

### 3.3 两组消息状态

比较 `currentContext.messages` 与 `newMessages`：

1. 两者分别保存什么范围的消息？
2. 为什么不能只维护一个数组？
3. prompt、assistant message 和 tool result 分别会被加入哪一个或哪两个？
4. `runLoop` 最终通过什么方式把本次新增消息交给调用方？

我的结论：

> 待填写。

### 3.4 配置与动态状态

1. `config` 为什么是可变变量，而不始终使用 `initialConfig`？
2. `prepareNextTurn` 能改变哪些内容？
3. 这些改变从哪一轮开始生效？

> 待填写。

---

## 4. 一个完整执行示例

使用下面的请求进行纸上追踪：

```text
读取 package.json，并告诉我项目名称。
```

假设模型第一轮返回一个 `read` tool call，第二轮返回自然语言答案。

| 步骤 | 当前输入或状态 | 执行的函数/行为 | 新产生的消息或事件 | 是否继续 |
|---|---|---|---|---|
| 1. 接收用户消息 |  |  |  |  |
| 2. 第一次调用模型 |  |  |  |  |
| 3. 发现 tool call |  |  |  |  |
| 4. 执行 read |  |  |  |  |
| 5. 写回 tool result |  |  |  |  |
| 6. 第二次调用模型 |  |  |  |  |
| 7. 得到最终答案 |  |  |  |  |
| 8. Agent 结束 |  |  |  |  |

追踪完成后回答：

1. 这个示例发生了几次 LLM 调用？
2. 发生了几次 Tool 执行？
3. 产生了几个 turn？
4. Tool 能否直接把结果当作最终回答交给用户？为什么？
5. 第二次 LLM 调用能看到哪些新增消息？

> 待填写。

---

## 5. Pi 源码事实

> 参考：Pi commit `853a80d26`。本节只记录由源码直接确认的事实；“为什么这样设计”的解释会放在第六章。

### 5.1 源码入口

- 文件：`pi/packages/agent/src/agent-loop.ts`
- 对外入口函数：`agentLoop()`、`agentLoopContinue()`
- 执行入口函数：`runAgentLoop()`、`runAgentLoopContinue()`
- 共享主循环函数：`runLoop()`
- 事件流创建函数：`createAgentStream()`
- 关键类型定义文件：`types.ts`

### 5.2 建议阅读顺序

第一轮只追主干：

1. `agentLoop` / `agentLoopContinue`
2. `runAgentLoop` / `runAgentLoopContinue`
3. `runLoop`
4. `streamAssistantResponse`
5. `executeToolCalls`

第二轮才进入工具参数准备、参数校验、并行执行等辅助函数。

### 5.3 主循环结构

核心循环位于 `runLoop()`。

| 结构 | 职责 | 继续条件 |
|---|---|---|
| 外层循环 | 内层将停止时读取 `getFollowUpMessages()`；有消息则重新进入内层 | follow-up 数组非空 |
| 内层循环 | 注入待处理消息、调用模型、执行 Tool、写回 Tool Result | `hasMoreToolCalls` 为真，或存在 `pendingMessages` |

关键状态：

- `lastCompletedTurn`：首次进入内层循环时为 `undefined`，因此不会重复发出第一个 `turn_start`（该事件已由 `runAgentLoop()` / `runAgentLoopContinue()` 发出）。每轮结束后，Agent 保存本轮的 assistant message、Tool Result、context 和 newMessages；下一轮开始前将它们交给 `prepareNextTurn()`。
- `pendingMessages`：由 `getSteeringMessages()` 初始化和更新；外层取得 follow-up 后，也会把该数组整体赋给它。
- `prompts`：由启动入口加入 context，不属于 `pendingMessages` 的来源。

证据：`agent-loop.ts` 的 `runAgentLoop`、`runAgentLoopContinue` 与 `runLoop`。

### 5.4 一次模型调用

`runLoop()` 调用 `streamAssistantResponse(currentContext, config, signal, emit, streamFunction)`。

```text
StreamFn(model, LLM context, options)
→ AssistantMessageEventStream
→ for await 处理流事件
→ finalMessage: AssistantMessage
```

- `streamFunction` 产生模型事件流；`streamAssistantResponse()` 最终返回 `AssistantMessage`。
- 收到 `start` 事件时，先把 partial assistant message 加入 `context.messages` 并发出 `message_start`。
- 后续流事件更新 context 中最后一条 assistant message，并发出 `message_update`。
- 流结束时：若已有 partial message，则用 final message 替换；否则追加 final message。
- `runLoop()` 在该函数返回后，将 final message 加入 `newMessages`。

证据：`streamAssistantResponse()`。
### 5.5 Tool call 的发现

模型回复 `message` 的类型是 `AssistantMessage`。Tool Call 从它的 `content` 中提取：

```ts
const toolCalls = message.content.filter((c) => c.type === "toolCall");
```

- `toolCalls` 的元素类型是 `AgentToolCall`；该类型用 `Extract` 从 `AssistantMessage["content"][number]` 中选出 `type: "toolCall"` 的成员。
- 一条 assistant message 可以包含多个 Tool Call：`content` 是数组，代码对 `toolCalls` 进行遍历。
- 顺序模式中，每个工具完成后才处理下一个；并行模式中，准备阶段仍顺序进行，准备完成的工具随后并行执行。
- 并行模式中，`tool_execution_end` 按完成顺序发出；`ToolResultMessage` 则按 assistant message 中的原始调用顺序发出。

证据：`AgentToolCall`、`executeToolCallsSequential()`、`executeToolCallsParallel()`。

### 5.6 Tool 的执行与结果写回

`executeToolCalls()` 接收并调度 Tool Call，返回：

```ts
type ExecutedToolCallBatch = {
  messages: ToolResultMessage[];
  terminate: boolean;
};
```

调用链：

```text
assistant message
→ toolCalls
→ executeToolCalls
→ ExecutedToolCallBatch.messages
→ currentContext.messages + newMessages
→ 下一轮 LLM
```

当 `message.stopReason === "length"` 时，模型输出达到 token 上限，Tool Call 参数可能被截断。Pi 不执行原始工具，而是为每个调用创建错误 Tool Result，并返回 `terminate: false`，让模型在下一轮看到失败原因后决定重试或改用其他方案。

Tool Result 同时写入两个数组：

- `currentContext.messages`：下一次模型调用的上下文。
- `newMessages`：本次 Agent run 的新增消息，最终作为结果返回给调用方。

证据：`runLoop()`、`failToolCallsFromTruncatedMessage()`、`ExecutedToolCallBatch`。

### 5.7 继续条件

内层循环条件为：

```ts
hasMoreToolCalls || pendingMessages.length > 0
```

| 状态 | 初始或来源 | 变化方式 | 为真时的结果 |
|---|---|---|---|
| `hasMoreToolCalls` | 每次进入外层循环时为 `true` | 模型响应后先设为 `false`；有 Tool Call 时设为 `!executedToolBatch.terminate` | 自动进入下一次内层迭代 |
| `pendingMessages` | 初次读取 `getSteeringMessages()`；无消息时为 `[]` | 注入 context 后清空；每个 turn 后再次读取 steering；外层 follow-up 可整体赋值 | 注入 context 后进入下一次模型调用 |
| `followUpMessages` | 内层将停止时读取 `getFollowUpMessages()` | 非空时赋给 `pendingMessages` 并 `continue` 外层 | 重新进入内层 |

重要区分：

- 模型返回 Tool Call 后**不一定**自动开始下一轮；是否继续取决于 `executedToolBatch.terminate` 与 `pendingMessages`。
- 截断处理不执行原始工具，但返回 `terminate: false`，因此通常会继续下一轮模型调用。
- 正常工具批次的 `terminate` 由 `shouldTerminateToolBatch()` 计算：至少有一个已完成调用，且每一个 finalized result 都严格设置 `terminate: true`，才会得到 `true`。
- 没有 Tool Call 但收到 steering message，仍会进入下一轮；该消息在下一次模型调用前写入 context。
- 下一轮开始前，`prepareNextTurn()` 可返回替换后的 context、model 或 reasoning。它是扩展点：只有调用方提供该回调并返回相应结果时，才会压缩 context、切换模型或调整 reasoning。


### 5.8 终止条件

| 终止路径 | 条件 | 控制流 | 事件 |
|---|---|---|---|
| 模型错误或取消 | `stopReason` 为 `error` 或 `aborted` | `return`，退出整个 `runLoop()` | `turn_end` → `agent_end` |
| 配置要求停止 | `shouldStopAfterTurn(...)` 返回 `true` | `return`，不再轮询 steering / follow-up | `agent_end` |
| 正常结束 | 内层停止，且 `getFollowUpMessages()` 为空 | `break` 外层循环 | 循环后发出 `agent_end` |
| 工具批次请求终止 | `executedToolBatch.terminate === true` | 令 `hasMoreToolCalls` 为 `false`；仍先检查 steering 和 follow-up | 只有后续没有消息时才最终 `agent_end` |

`terminate: true` 不是立即 `return`，而是停止由当前 Tool 批次触发的自动下一轮。

### 5.9 事件顺序

场景 A：新 prompt 后模型直接回答。

```text
agent_start
→ turn_start
→ 用户 message_start / message_end
→ assistant message_start
→ assistant message_update（0 次或多次）
→ assistant message_end
→ turn_end
→ agent_end
```

场景 B：模型调用一次 Tool，再给出最终回答。

```text
agent_start
→ 第一个 turn_start
→ 用户 message_start / message_end
→ 第一次 assistant message_start / update（0 次或多次）/ message_end
→ tool_execution_start / update（0 次或多次）/ tool_execution_end
→ tool result message_start / message_end
→ 第一个 turn_end
→ prepareNextTurn（可选：压缩 context、切换模型或调整 reasoning）
→ 第二个 turn_start
→ 第二次 assistant message_start / update（0 次或多次）/ message_end
→ 第二个 turn_end
→ agent_end
```

- 一次完整 Agent run 中，`agent_start` 与 `agent_end` 各发生一次。
- 每个 turn 都有 `turn_start` 与 `turn_end`；第一个 `turn_start` 在进入 `runLoop()` 前发出。
- user、assistant、tool result 都会有 message 生命周期事件；`message_update` 只用于 assistant 的流式输出。
- `agentLoopContinue()` 没有新 prompt，因此不一定出现用户 message 事件。

#### 为什么未终止的工具批次会产生第二个 turn？

```text
Tool Result 中存在任一 terminate !== true
→ shouldTerminateToolBatch(...) 返回 false
→ executedToolBatch.terminate 为 false
→ hasMoreToolCalls = !false = true
→ 内层 while 进入下一次迭代
→ prepareNextTurn（若配置）处理上一轮状态
→ 发出第二个 turn_start
→ 模型读取包含 Tool Result 的 context
```

这不是“任何 Tool Call 都一定有第二个 turn”。当所有 finalized Tool Result 都明确设置 `terminate: true` 时，当前工具批次不会自动触发下一轮。截断 Tool Call 的处理函数则固定返回 `terminate: false`：它不执行原始工具，但把错误 Tool Result 交给模型，以便模型重试或采取其他行动。

---

## 6. 我的理解

学习完后，不看源码回答：

1. Agent Loop 本质上是循环、状态机，还是事件驱动调度器？为什么？
2. 模型在循环中负责什么？运行时负责什么？
3. “模型决定调用工具”和“运行时决定是否继续”有什么区别？
4. Context 为什么是 Agent Loop 的核心状态？
5. Tool result 为什么必须作为消息返回模型，而不是只在程序内部保存？
6. Pi 的双层循环是通用 Agent 必须采用的结构，还是为 steering/follow-up 支持做出的实现选择？

我的总结：

1. Agent Loop 的核心是由状态和条件驱动的控制循环，也可以理解为状态机；它通过事件流将执行过程暴露给外部。是否进入下一轮由 Tool Call、`terminate`、待处理消息和停止配置等状态共同决定，而不只是“是否还有 event”。
2. 模型负责基于 Context 输出文本或请求 Tool；运行时负责执行 Tool、校验参数、维护 Context、写回结果，并根据控制条件决定是否实际发起下一轮。ReAct 是模型与运行时协作形成的工作方式，不是运行时单独完成的策略。
3. 模型的 Tool Call 是对外部行动的请求，不是对循环控制的最终命令：模型提出“做什么”，例如请求 `read_file` 并给出参数；运行时拥有执行与调度权，负责验证工具和参数、执行或拒绝请求、写回结果，并根据 `terminate`、停止配置、steering / follow-up 等状态决定是否继续。模型决定行动意图，运行时决定如何安全执行以及执行后是否进入下一轮。
4. Context 保存系统指令、历史消息、assistant 回复和 Tool Result，是模型每次调用时可见的事实状态。没有它，模型无法知道已执行哪些工具、工具返回了什么，也无法基于真实结果继续行动。
5. Tool Result 必须以模型可理解的消息形式写回 Context；只保存在程序内部，模型下一轮看不见它，因此无法据此决定后续行动。
6. Pi 的双层 `while` 是为 steering / follow-up 队列设计的实现选择。自己的第一版可使用单层循环，等需要处理运行中的插队消息或结束后的排队消息时再扩展。

### 通用原理与 Pi 实现选择

| 内容 | 通用原理 / Pi 实现选择 | 判断依据 |
|---|---|---|
| 模型返回 tool call 后执行工具 | 通用原理 | 模型不能自行执行外部操作；运行时必须把请求转换为真实执行。 |
| tool result 加回模型上下文 | 通用原理 | 模型必须看到工具执行的真实结果，才能决定后续行动。 |
| 使用双层 `while` | Pi 实现选择 | 用于在正常工具循环之外支持 follow-up 消息队列。 |
| 使用 `EventStream` 暴露过程事件 | Pi 实现选择 | 便于 UI、日志或调用方观察执行过程，但最小 Agent 不必采用同一接口。 |
| 支持 steering 与 follow-up messages | Pi 扩展能力 | 支持运行中插入消息和 Agent 原本结束后的排队消息。 |
| 每轮可调整 model 和 reasoning | Pi 扩展能力 | `prepareNextTurn()` 可替换下一轮模型、推理等级或 Context。 |

---

## 7. 我的 Agent 设计

> 这一节不是复刻 Pi，而是从已经理解的机制中选择第一版真正需要的部分。

### 7.1 第一版必须有

请学习后判断并勾选：

- [x] 消息 context
- [x] 一次模型调用接口
- [x] 识别 tool calls
- [x] Tool Registry
- [x] 参数校验
- [x] 执行 Tool
- [x] 把 tool result 加回 context
- [x] 没有 tool call 时结束
- [x] 最大循环次数
- [x] 基本错误处理

需要补充的能力：
- 第一版目标：M1 ：工具化 Agent Loop。第一版只注册一个 Tool 类型，但允许模型在同一轮中顺序调用它多次。
- 支持：一个或多个顺序 Tool Call、Tool Result 写回 Context、最大轮数、基础错误 Tool Result。
- 不支持：steering、follow-up、并行 Tool、模型切换、自动重试、复杂事件流。

### 7.2 第一版明确不做

逐项说明为什么可以延后：

| 能力                  | 是否延后 | 原因                             |
| ------------------- | ---- | ------------------------------ |
| steering messages   | 是    | 当前完成一个信息处理就行，不用中间转向            |
| follow-up queue     | 是    | 同上                             |
| 并行 tool calls       | 是    | 当前跑通一个工具就行                     |
| 动态切换 model          | 是    | 一个model就行                      |
| 动态调整 reasoning      | 是    | 不需要，模型供应商提供的推理强度/思考预算选项固定一个先就行 |
| 复杂事件流               | 是    | 当前能正确完成一个指令就行                  |
| retry / continue 入口 | 是    | 第一版只返回清晰错误，不恢复已有 Context 或自动重试 |


### 7.3 最小伪代码

学习完成后，关闭 Pi 源码并独立补全：

```python
def run_agent(user_message):
    context = [user_message]

    for step in range(MAX_STEPS):
        assistant_message = llm.call(context)
        context.append(assistant_message)

        tool_calls = find_tool_calls(assistant_message)
        if not tool_calls:
            return assistant_message

        for tool_call in tool_calls:
            tool_result = execute_tool(tool_call, tool_registry)
            context.append(tool_result)

    return max_steps_error()
```

### 7.4 设计决定

| 决定                                   | 原因                                   | 代价                     | 何时重新评估                  |
| ------------------------------------ | ------------------------------------ | ---------------------- | ----------------------- |
| 第一版使用单层循环                            | 简单，快速跑通                              | 无法处理steering/follow-up | 需要 steering/follow-up 时 |
| 第一版顺序执行工具                            | 简单                                   | 支持并行的多工具被调用时运行较慢       | 多个独立慢工具明显影响延迟时          |
| 设置最大循环次数                             | 防止无限死循环运行                            | 复杂任务被提前中断              | 有更成熟的预算控制后              |
| Tool 不存在、参数无效或执行失败时，转换为错误 Tool Resul | Tool 不存在、参数无效或执行失败时，转换为错误 Tool Resul | 要维护统一错误格式              |                         |
| `MAX_STEPS = 8`                      | 防止无限循环与成本失控                          | 复杂任务可能提前停止             |                         |

---

## 8. 错误与边界情况

第一轮只确认 `runLoop` 如何响应；之后研究 Tool System 时再深入工具内部。

| 情况 | Pi 的实际行为 | 源码证据 | 我的 Agent 第一版行为 |
|---|---|---|---|
| 模型返回 `error` |  |  |  |
| 模型返回 `aborted` |  |  |  |
| 模型输出因长度被截断 |  |  |  |
| Tool 不存在 | 后续填写 | 后续填写 |  |
| Tool 参数无效 | 后续填写 | 后续填写 |  |
| Tool 执行抛错 | 后续填写 | 后续填写 |  |
| Tool 要求终止后续调用 |  |  |  |
| 模型持续调用工具 |  |  |  |
| 用户在运行中发送 steering message |  |  | 第一版暂不支持 |
| Agent 将要结束时收到 follow-up |  |  | 第一版暂不支持 |

需要进一步思考：

1. Pi 的主循环本身是否设置最大轮数？
2. 如果没有，防止无限循环的责任位于哪里？
3. 自己的第一版是否应该做出不同选择？为什么？

> 待填写。

---

## 9. 尚未验证的问题

阅读过程中把猜测先放在这里，不要直接写进“源码事实”。

- [ ] `streamAssistantResponse` 在哪里把 assistant message 加入当前 context？
- [ ] 同一条 assistant message 中的多个 tool calls 默认顺序还是并行执行？
- [ ] 哪些 Tool 可以要求顺序执行？
- [ ] 哪些工具结果会终止剩余的 tool calls？
- [ ] `prepareNextTurn` 的实际调用方和使用场景是什么？
- [ ] `shouldStopAfterTurn` 的实际调用方和使用场景是什么？
- [ ] 主循环是否存在轮数、token 或费用上限？
- [ ] `agentLoopContinue` 在上层的实际重试链路是什么？
- [ ] steering message 与 follow-up message 的语义差别是什么？
- [ ] 

每验证一项，记录结论和证据后再勾选。

---

## 10. 验收标准

### 核心验收

- [ ] 能指出 Agent Loop 的主循环函数
- [ ] 能指出 tool call 的提取位置
- [ ] 能解释有 tool call 时的继续条件
- [ ] 能解释没有 tool call 时的结束路径
- [ ] 能追踪 tool result 回到下一轮 context

### 理解验收

- [ ] 能不看源码画出 `用户 → 模型 → Tool → 模型 → 最终答案`
- [ ] 能用“读取 package.json”的例子走完整条路径
- [ ] 能解释 `currentContext.messages` 和 `newMessages` 的区别
- [ ] 能列出错误、取消和正常结束三类终止路径
- [ ] 能区分一个 turn 与一次完整 Agent run
- [ ] 能区分通用 Agent Loop 原理与 Pi 的扩展能力

### 实现准备验收

- [ ] 能写出自己的最小 Agent Loop 伪代码
- [ ] 能说明第一版必须实现哪些能力
- [ ] 能说明第一版暂不实现哪些能力及原因
- [ ] 能定义至少一个防止无限循环的机制

全部完成后，将 [[00-学习地图]] 中“看懂 Agent Loop 的主循环”标记为完成，再进入单个 Tool 的完整链路。

---

## 11. 关联内容

- 上游模块：[[02-模型与Provider]]
- 全局视图：[[01-整体架构]]
- 学习入口：[[00-学习地图]]
- 当日记录：[[学习日志/2026-08-13]]
- 下一模块：Tool System（完成本模块后再创建）

## 更新记录

- 2026-08-13：创建 Agent Loop 源码学习工作表，预填阅读入口、引导问题和验收标准。
