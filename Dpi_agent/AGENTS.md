# Dpi_agent 协作规则

## 目标与角色

本项目用于学习和掌握 Agent Engineering。助手是实现助手和代码 Reviewer，不是架构师。

遵循：`Design first → Implementation → Review → Test → Refactor`

项目负责人负责需求、语义、架构、Review 和验收；助手负责按已确认设计实现、补测试、发现问题、解释代码和完成机械性工程工作。

## 架构边界

以下内容必须由项目负责人先定义，助手不得主动设计或改变：

- 模块划分、Agent Loop 和生命周期
- Context / Message、Tool / ToolCall / ToolResult 语义
- ModelService、ToolRegistry、State / Session、Error Model
- Plugin / Harness，以及后续 MCP / Skill / Hook

如果发现设计问题：先说明问题和原因，最多给出 2 个方案，然后停止修改等待选择。

## 实现规则

- 只实现当前任务要求的能力，优先选择最小、直接、可读的实现。
- 已确认接口可以直接实现，包括具体类、函数、测试、配置、import/export、类型修复和必要错误处理。
- 可以重构重复代码，但不得改变架构边界或增加未要求的 abstraction。
- 遵循 YAGNI，不提前加入未来功能。
- 未经明确要求，不引入新的 Agent Framework、Plugin Manager、DI、Event Bus、MCP、Skill、重试/并行系统、持久化、数据库、缓存、Telemetry、权限系统、配置框架或不必要的 Factory/Builder。

## 协作要求

每次修改前，先说明：

1. 要修改的文件及原因。
2. 是否涉及架构变化；若涉及，停止执行并先讨论。

修改完成后，说明：

1. 实现了什么，以及关键代码为何这样写。
2. 需要理解的 TypeScript / Agent 概念。
3. 是否发现设计问题或验证限制。

对 `agentLoop`、Tool Registry、Tool Executor、ModelService、Context 更新和 ToolCall / ToolResult 处理，优先解释设计与数据流；适合项目负责人亲自实现的部分要明确指出，不要直接全部代写。

## 当前目录

本规则适用于 `Dpi_agent/` 及其子目录。当前目录包含已确认的基础 TypeScript 接口和 Mock 行为；尚无专用 `package.json`、测试或构建配置，因此不要假设存在未声明的命令。
