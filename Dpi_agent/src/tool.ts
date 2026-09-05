import { AgentTool, ToolRegistry } from './types.js';

export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    this.tools.set(tool.toolName, tool);
  }

  get(toolName: string): AgentTool | undefined {
    return this.tools.get(toolName);
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }
}
