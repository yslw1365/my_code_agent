# my_code_agent

通过阅读 Pi 的实现，学习 Code Agent 的核心架构，并逐步实现自己的最小 Code Agent。

## 当前阶段

正在研究 Agent Loop：

- 模型如何产生 tool call
- Agent Runtime 如何执行 Tool
- tool result 如何回到 Context
- Agent Loop 如何继续或终止

## 项目结构

- `学习笔记/`：按核心模块整理的学习笔记
- `Dpi_agent/`：独立的 TypeScript Code Agent 子项目
  - `src/`：源码
  - `tests/`：测试
  - `package.json`、`tsconfig.json`、`vitest.config.ts`：子项目配置

## 参考项目

- Pi：<https://github.com/earendil-works/pi>
- 当前学习版本：`afae6a1a9`
