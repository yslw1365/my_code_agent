# Agent Loop

> 本笔记是一份源码学习工作表。先独立阅读和填写，再把“猜测”升级为有源码或实验支持的“事实”。

## 学习状态

- 状态：学习中
- 开始日期：2026-08-13
- 最近更新：2026-08-13
- 关联学习地图：[[00-学习地图]]
- 参考项目：Pi
- 参考版本或 commit：`afae6a1a9`
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

> 这里只填写能由源码或实验直接确认的内容。每个结论都记录证据位置。

### 5.1 源码入口

- 文件：`pi/packages/agent/src/agent-loop.ts`
- 对外入口函数：待填写
- 执行入口函数：待填写
- 共享主循环函数：待填写
- 事件流创建函数：待填写
- 关键类型定义文件：待填写

### 5.2 建议阅读顺序

第一轮只看主干：

1. `agentLoop` / `agentLoopContinue`
2. `runAgentLoop` / `runAgentLoopContinue`
3. `runLoop`
4. `streamAssistantResponse`
5. `executeToolCalls`

第二轮再按问题进入辅助函数，不要第一遍就逐行研究整份文件。

### 5.3 主循环结构

1. 文件中为什么有内外两层循环？
2. 外层循环负责什么？
3. 内层循环负责什么？
4. `firstTurn` 影响哪个事件？
5. `pendingMessages` 可以来自哪里？

证据：

- 文件位置：
- 关键变量或条件：

我的事实描述：

> 待填写。

### 5.4 一次模型调用

1. 哪个函数真正触发 assistant response 的流式生成？
2. 调用前传入了哪些状态？
3. 返回的 `message` 是什么类型？
4. assistant message 在哪里加入 `newMessages`？
5. 它在什么位置加入当前 context，还是由其他函数处理？

证据与答案：

> 待填写。

### 5.5 Tool call 的发现

1. Tool call 从哪个对象中提取？
2. 使用什么条件筛选？
3. `toolCalls` 的元素类型是什么？
4. 一条 assistant message 是否可能包含多个 tool call？依据是什么？

记录关键表达式，不复制大段源码：

```ts
// 待填写
```

### 5.6 Tool 的执行与结果写回

1. 哪个函数接收并执行 tool calls？
2. 哪种 `stopReason` 会阻止正常执行工具？为什么？
3. 执行结果包含哪两个对循环控制最重要的字段？
4. tool result 在哪里加入 `currentContext.messages`？
5. tool result 在哪里加入 `newMessages`？
6. 为什么两个数组都需要加入？
7. 下一轮模型调用为什么能够看到这些 tool results？

关键调用链：

```text
assistant message
→ 待填写
→ 待填写
→ ToolResultMessage
→ 待填写
→ 下一轮 LLM
```

证据位置：

> 待填写。

### 5.7 继续条件

为每个变量写出它的含义以及如何变化：

| 变量或条件 | 初始值 | 在哪里更新 | 为真时发生什么 |
|---|---|---|---|
| `hasMoreToolCalls` |  |  |  |
| `pendingMessages.length > 0` |  |  |  |
| `followUpMessages.length > 0` |  |  |  |

然后回答：

1. “模型返回了 tool call”是否必然进入下一轮？
2. 哪个执行结果可能要求 Agent 不再继续工具循环？
3. 没有 tool call，但存在 steering message 时是否继续？
4. 内层循环结束后，什么情况会让外层循环继续？

结论：

> 待填写。

### 5.8 终止条件

找出每一条终止路径，并区分 `return` 与 `break`：

| 终止原因 | 判断条件 | 结束哪层循环或函数 | 结束前发出什么事件 |
|---|---|---|---|
| 模型错误 |  |  |  |
| 用户取消 |  |  |  |
| 配置要求本轮后停止 |  |  |  |
| 无更多工具或消息 |  |  |  |
| 工具执行要求终止 |  |  |  |

思考：工具执行要求终止时，是立即 `return`，还是通过修改循环状态在稍后结束？

> 待填写。

### 5.9 事件顺序

分别写出以下两种场景的事件顺序。

场景 A：模型直接回答，无 tool call。

```text
待填写
```

场景 B：模型调用一次 Tool，然后给出最终回答。

```text
待填写
```

回答：

1. `agent_start` 与 `agent_end` 各发生几次？
2. 每一轮是否都有 `turn_start` 与 `turn_end`？
3. user、assistant 和 tool result 是否都会产生 message 事件？

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

> 待填写。

### 通用原理与 Pi 实现选择

| 内容 | 通用原理 / Pi 实现选择 | 判断依据 |
|---|---|---|
| 模型返回 tool call 后执行工具 |  |  |
| tool result 加回模型上下文 |  |  |
| 使用双层 `while` |  |  |
| 使用 `EventStream` 暴露过程事件 |  |  |
| 支持 steering 与 follow-up messages |  |  |
| 每轮可调整模型和 reasoning |  |  |

---

## 7. 我的 Agent 设计

> 这一节不是复刻 Pi，而是从已经理解的机制中选择第一版真正需要的部分。

### 7.1 第一版必须有

请学习后判断并勾选：

- [ ] 消息 context
- [ ] 一次模型调用接口
- [ ] 识别 tool calls
- [ ] Tool Registry
- [ ] 参数校验
- [ ] 执行 Tool
- [ ] 把 tool result 加回 context
- [ ] 没有 tool call 时结束
- [ ] 最大循环次数
- [ ] 基本错误处理

需要补充的能力：

- [ ] 

### 7.2 第一版明确不做

逐项说明为什么可以延后：

| 能力 | 是否延后 | 原因 |
|---|---|---|
| steering messages |  |  |
| follow-up queue |  |  |
| 并行 tool calls |  |  |
| 动态切换 model |  |  |
| 动态调整 reasoning |  |  |
| 复杂事件流 |  |  |
| retry / continue 入口 |  |  |

### 7.3 最小伪代码

学习完成后，关闭 Pi 源码并独立补全：

```python
def run_agent(user_message):
    messages = []
    # 1. 将用户消息加入 context

    for step in range(MAX_STEPS):
        # 2. 调用模型

        # 3. 保存 assistant message

        # 4. 如果没有 tool call，返回最终答案

        # 5. 执行 tool calls

        # 6. 将 tool results 加入 context

    # 7. 处理超过最大轮数
```

### 7.4 设计决定

| 决定 | 原因 | 代价 | 何时重新评估 |
|---|---|---|---|
| 第一版使用单层循环 | 待填写 | 待填写 | 需要 steering/follow-up 时 |
| 第一版顺序执行工具 | 待填写 | 待填写 | 多个独立慢工具明显影响延迟时 |
| 设置最大循环次数 | 待填写 | 待填写 | 有更成熟的预算控制后 |
| 其他： |  |  |  |

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
