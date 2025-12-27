/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: TOOLS.MCP.SCHEMA.MAIN
   REGION: 🟣 MCP
   VERSION: 1.0.0
   ============================================================================
   ToolTypes.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render
   ============================================================================ */

export type ToolName =
  | "memory.artifact.create"
  | "memory.rag.query"
  | "memory.rag.upsert"
  | "cad.export"
  | "system.voice.get"
  | "system.voice.setProfile"
  | "system.voice.setTuning"
  | "system.voice.setInterruptMode";

export type ToolCall<TArgs = any> = {
  name: ToolName;
  arguments: TArgs;
};

export type ToolResult<T = any> =
  | { ok: true; name: ToolName; data: T }
  | { ok: false; name: ToolName; error: string };

export type ToolDefinition<TArgs = any, TOut = any> = {
  name: ToolName;
  description: string;
  argsShape: Record<string, string>;
  requiresUserApproval?: boolean;
  run: (args: TArgs) => Promise<ToolResult<TOut>>;
};

export type ToolPermissionPolicy = {
  autoApprove: boolean;
  allowed: Partial<Record<ToolName, boolean>>;
};
