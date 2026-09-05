import { describe, expect, it } from 'vitest';
import { DefaultToolRegistry } from '../src/tool.js';
import type { AgentTool } from '../src/types.js';

describe('DefaultToolRegistry', () => {
  it('registers and retrieves a tool by name', () => {
    const registry = new DefaultToolRegistry();
    const tool: AgentTool = {
      toolName: 'test-tool',
      toolDesc: 'A tool used by the registry test',
      toolSchema: {},
      toolFunc: async () => 'ok',
      validateArgs: () => true,
    };

    registry.register(tool);

    expect(registry.get('test-tool')).toBe(tool);
    expect(registry.list()).toEqual([tool]);
  });
});
