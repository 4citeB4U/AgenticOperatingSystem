/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: TOOLS.MCP.BOOTSTRAP.MAIN
   REGION: 🟣 MCP
   VERSION: 1.0.0
   ============================================================================
   createToolRegistry.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render
   ============================================================================ */

import { ToolRegistry } from "./ToolRegistry";
import type { ToolPermissionPolicy } from "./ToolTypes";
import { buildBuiltinTools } from "./builtinTools";

export function createToolRegistry(policy?: Partial<ToolPermissionPolicy>) {
  const merged: ToolPermissionPolicy = {
    autoApprove: false, // keep safe by default; set true only in trusted local builds
    ...(policy ?? {}),
    allowed: { ...(policy?.allowed ?? {}) },
  };

  const reg = new ToolRegistry(merged);
  for (const t of buildBuiltinTools()) reg.register(t);
  return reg;
}
