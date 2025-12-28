<!-- ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   copilot-instructions.md
   
   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=support;
     INTENT_SCOPE=n/a;
     LOCATION_DEP=none;
     VERTICALS=n/a;
     RENDER_SURFACE=in-app;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ -->

# Copilot Instructions for Agent Lee: Agentic Operating System

## Project Overview
- **Agent Lee** is a browser-based, local-first Agentic Operating System. All AI, data, and logic run client-side—no backend, no cloud dependencies by default.
- Core architecture: **Single-File Monolith (SFM)**, with all modules integrated into a unified surface.
- **Memory Lake** is the central evidence vault: 8 drives × 8 slots = 64GB, with strict partitioning and color-coded health states.
- **Zero-Egress Policy**: All remote calls (LLM, embeddings, TTS, etc.) are blocked unless explicitly enabled by the user.

## Key Components & Data Flows
- **Memory Lake**: All state, artifacts, and evidence are written/read here. Modules signal `LAKE_CHANGED` events to synchronize state.
- **Email Center (LeeMail)**: Ingests, summarizes, and archives mail as Lake artifacts. Outgoing mail and attachments are also stored as artifacts.
- **Communications Outlet**: Phone, messages, video, and contacts are unified. All interactions become Lake artifacts.
- **Policy & Settings**: Enforces Zero-Egress, sensor gating, and capability gates at runtime.
- **Style Core**: Ensures consistent, operator-friendly UI/UX.
- **Tools**: Voice, vision, research, and image generation are gated and produce artifacts.

## Developer Workflows
- **Install**: `npm install`
- **Dev server**: `npm run dev` (Vite + React + TypeScript)
- **Build**: `npm run build`
- **Model Placement**: Place ONNX models in `public/models/` (see README for structure)
- **No backend**: All logic is in-browser; do not add server dependencies.

## Project-Specific Patterns
- **Artifacts**: Every meaningful output (summary, task, note, attachment, decision) is a Lake artifact. Artifacts are always timestamped and signed for lineage.
- **Eventing**: Use `LAKE_CHANGED` to notify modules of state changes.
- **Drives**: Use the correct drive for each artifact type (see README for drive purposes).
- **Link-Files**: For large data, store external 1GB containers and reference them in the Lake.
- **Corruption Handling**: Isolate, quarantine, and report corruption events as artifacts.
- **Zero-Egress**: Never assume network access; always check policy before remote calls.

## Integration Points
- **ONNX/Transformers.js**: Local model inference only. Models are loaded from `public/models/`.
- **Email/IMAP/SMTP**: All mail is processed and stored locally; no cloud relay.
- **WebGPU**: Used for quantized model inference (Q4, 4-bit weights).
- **Tailwind CSS**: Used for UI styling.

## Examples
- To add a new module, ensure it writes/reads artifacts from the Lake and signals `LAKE_CHANGED`.
- When handling user data, always partition by drive and slot, and update health status as needed.
- For new tools, gate capabilities via policy and ensure all outputs are stored as artifacts.

## Reference Files
- `src/MemoryLake.tsx`, `src/memoryLakeOS.ts`, `src/memoryLakeAdapter.ts`: Lake logic
- `src/EmailCenter.tsx`: Email integration
- `src/CommunicationsOutlet.tsx`: Communications logic
- `src/LocalModelHub.ts`, `src/modelRegistry.ts`: Model loading/registry
- `src/policyClient.ts`, `src/SystemSettings.tsx`: Policy and settings
- `README.md`: Architecture, conventions, and operator playbook

---

**For AI agents:**
- Always prefer local, auditable, and partitioned data flows.
- Never introduce cloud dependencies or break Zero-Egress by default.
- Use the Lake as the single source of truth for all state and evidence.
- Reference the README for drive purposes, artifact types, and operator routines.
