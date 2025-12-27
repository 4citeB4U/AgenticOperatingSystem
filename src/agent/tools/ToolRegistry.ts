/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: TOOLS.MCP.REGISTRY.MAIN
   REGION: 🟣 MCP
   VERSION: 1.0.0
   ============================================================================
   ToolRegistry.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render
   ============================================================================ */

import type { ToolDefinition, ToolName, ToolPermissionPolicy, ToolResult } from "./ToolTypes";

export class ToolRegistry {
  private tools = new Map<ToolName, ToolDefinition>();

  constructor(private policy: ToolPermissionPolicy) {}

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  list() {
    return [...this.tools.values()];
  }

  async invoke(name: ToolName, args: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, name, error: `Unknown tool: ${name}` };

    const allowed = this.policy.allowed[name];
    if (allowed === false) return { ok: false, name, error: `Tool blocked by policy: ${name}` };

    if (tool.requiresUserApproval && !this.policy.autoApprove) {
      return { ok: false, name, error: `User approval required for: ${name}` };
    }

    try {
      return await tool.run(args);
    } catch (e: any) {
      return { ok: false, name, error: e?.message ?? String(e) };
    }
  }
}
