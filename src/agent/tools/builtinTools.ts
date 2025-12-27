/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: TOOLS.MCP.BUILTIN.MAIN
   REGION: 🟣 MCP
   VERSION: 1.0.0
   ============================================================================
   builtinTools.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render
   ============================================================================ */

import type { ToolDefinition } from "./ToolTypes";

// Memory Lake OS (your canonical persistence surface)
import { createArtifact, exportCadToLake } from "../../memoryLakeOS";

// RAG
import { ragQuery, ragUpsert } from "../../ragLake";

// Voice config tools
import { loadVoiceConfig, updateVoiceConfig } from "../../voice/voiceStore";

export function buildBuiltinTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  tools.push({
    name: "memory.artifact.create",
    description: "Create a structured artifact in Memory Lake (local-only).",
    argsShape: {
      kind: "string",
      driveId: "string",
      slotId: "number",
      path: "string?",
      name: "string",
      category: "string",
      content: "any",
      signature: "string?",
      tags: "string[]?",
      annotations: "any[]?",
      meta: "object?",
      mime: "string?",
      compress: "boolean?",
    },
    requiresUserApproval: false,
    run: async (args: any) => {
      const saved = await createArtifact(args);
      return { ok: true, name: "memory.artifact.create", data: saved };
    },
  });

  tools.push({
    name: "memory.rag.query",
    description: "Query local RAG store (IndexedDB) and return ranked hits.",
    argsShape: {
      query: "string",
      topK: "number?",
      driveFilter: "string?",
      slotFilter: "number?",
    },
    requiresUserApproval: false,
    run: async (args: any) => {
      const hits = await ragQuery(args);
      return { ok: true, name: "memory.rag.query", data: hits };
    },
  });

  tools.push({
    name: "memory.rag.upsert",
    description: "Upsert a document/vector into local RAG (IndexedDB).",
    argsShape: {
      id: "string?",
      signature: "string?",
      driveId: "string",
      slotId: "number",
      path: "string?",
      name: "string",
      text: "string",
      meta: "object?",
    },
    requiresUserApproval: false,
    run: async (args: any) => {
      const doc = await ragUpsert(args);
      return { ok: true, name: "memory.rag.upsert", data: doc };
    },
  });

  tools.push({
    name: "cad.export",
    description: "Export CADSpec JSON + STL into Memory Lake (local-only).",
    argsShape: {
      driveId: "string",
      slotId: "number",
      projectPath: "string?",
      name: "string",
      spec: "object",
      alsoDownload: "boolean?",
    },
    requiresUserApproval: true,
    run: async (args: any) => {
      const res = await exportCadToLake(args);
      return { ok: true, name: "cad.export", data: res };
    },
  });

  // Voice tools (so Agent Lee can read/change settings deterministically)
  tools.push({
    name: "system.voice.get",
    description: "Get current voice config (localStorage).",
    argsShape: {},
    requiresUserApproval: false,
    run: async () => {
      return { ok: true, name: "system.voice.get", data: loadVoiceConfig() };
    },
  });

  tools.push({
    name: "system.voice.setProfile",
    description: "Patch voice profile (portable) and persist (localStorage).",
    argsShape: { profile: "object" },
    requiresUserApproval: false,
    run: async (args: any) => {
      const next = updateVoiceConfig({ profile: args?.profile ?? {} });
      return { ok: true, name: "system.voice.setProfile", data: next };
    },
  });

  tools.push({
    name: "system.voice.setTuning",
    description: "Patch voice tuning and persist (localStorage).",
    argsShape: { tuning: "object" },
    requiresUserApproval: false,
    run: async (args: any) => {
      const next = updateVoiceConfig({ tuning: args?.tuning ?? {} });
      return { ok: true, name: "system.voice.setTuning", data: next };
    },
  });

  tools.push({
    name: "system.voice.setInterruptMode",
    description: "Set interrupt mode (cancel|queue) and persist (localStorage).",
    argsShape: { interruptMode: "string" },
    requiresUserApproval: false,
    run: async (args: any) => {
      const next = updateVoiceConfig({ interruptMode: args?.interruptMode });
      return { ok: true, name: "system.voice.setInterruptMode", data: next };
    },
  });

  return tools;
}
