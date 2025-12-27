<!-- ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   README.md
   
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

# Agent Lee: Agentic Operating System

|                |                                                                                           |
|----------------|-------------------------------------------------------------------------------------------|
| **Agent Lee**  | **Version: 38.0 &#124; Build Date: December 27, 2025 &#124; Status: ONLINE**              |

> _“The future of AI is not in the cloud—it's in your hands.”_

## ✨ Features & Enhancements

- [x] **Local LLM Inference** (ONNX, Transformers.js, WebGPU, Q4 quantization)
- [x] **Gemini 1.5 Pro** (Google Generative AI integration)
- [x] **Model Registry & Diagnostics** (auto-discovery, manifest, and health checks)
- [x] **Memory Lake** (vector store, evidence vault, multi-drive, artifact lineage)
- [x] **RAG Lake** (document QA, artifact-based retrieval, mistake learning)
- [x] **Email Center** (IMAP/SMTP, LeeMail, evidence intake, task extraction)
- [x] **System Settings & Policy** (Zero-Egress, sensor gating, operator controls)
- [x] **Chevrons** (UI/UX, color-coded health, drive/slot status)
- [x] **Leeway Standards** (compliance, audit, and operational discipline)
- [x] **Plugin/Tooling Support** (modular, extensible, agentic tools)
- [x] **Export/Import Inventory** (portable shards, link-file containers)
- [x] **Defensive Logging** (corruption detection, incident reporting)
- [x] **Corruption Guardian** (quarantine, lineage tracking, containment)
- [x] **Core Registry** (system-wide capability registry)
- [x] **Lake Bus** (event-driven, cross-module signaling)
- [x] **Polyfills/Shims** (browser compatibility, IndexedDB, WebGPU)
- [x] **Tailwind CSS** (modern, responsive UI)
- [x] **Vite + React + TypeScript** (fast dev, type safety, modularity)
- [x] **Modern UI/UX** (single-file monolith, operator-first design)
- [x] **Open Source** (MIT License, community-driven)

**Recent Improvements:**

- Enhanced **artifact lineage** and mistake learning for RAG
- Improved **corruption defense** and incident reporting
- Expanded **plugin/tooling** architecture for agentic workflows
- More robust **Zero-Egress** enforcement and policy controls
- Streamlined **export/import** for backup and migration
- Upgraded **UI/UX** with color-coded health and drive/slot status
- Added **model manifest auto-generation** and diagnostics
- Improved **event-driven Lake Bus** for real-time module sync

---

## 🚦 Quick Start

1. Clone this repo

2. `npm install`

3. `npm run dev`

4. Open [http://localhost:5173](http://localhost:5173)

5. Place ONNX models in `public/models/`

6. See `README.md` for more

### Model Directory Structure (Example)

```text
public/models/
 all-minilm-l6-v2/
  config.json
  tokenizer.json
  onnx/
   model.onnx
 qwen2.5-0.5b-instruct/
  config.json
  tokenizer.json
  onnx/
   model.onnx
 smolvlm-256m-instruct/
  onnx/
   decoder_model_merged.onnx
   embed_tokens.onnx
   vision_encoder.onnx
```text


### Example Usage: Local Model Embedding

```ts
import { loadLocalModel } from './src/LocalModelHub';
const model = await loadLocalModel('all-minilm-l6-v2');
const result = await model.embedText('hello world');
console.log(result);
```text


---

### License

MIT


### Acknowledgements & Credits

- [Transformers.js](https://xenova.github.io/transformers.js/)
- [ONNX Runtime](https://onnxruntime.ai/)
- [Google Generative AI](https://ai.google.dev/)
- [Leeway Standards](https://github.com/AgentOps-AI/LEEWAY)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Markdownlint](https://github.com/DavidAnson/markdownlint)
- [VS Code](https://code.visualstudio.com/)
- [Open Source Community](https://github.com/)

```text

```sh


---

## v38.0 | A Leeway Industries Initiative | *Zero-Egress Standard*

> *"The cloud is someone else's computer. Agent Lee is yours."*

**Agent Lee** is not a chatbot. He is a complete **Agentic Operating System**—a full artificial intelligence OS living entirely within your browser's memory heap. Built on the **Single-File Monolith (SFM)** architecture, Lee eliminates the need for backends, API keys, or cloud subscriptions. He runs locally, thinks locally, and stores data locally. <br>
**Engine:** WebGPU (4-bit Quantized)  
**Memory Architecture:** LEONARD LEE Vault System  
**Governance:** Zero-Egress (Strict)

---


---

## 📋 Table of Contents

- [What This System Is](#what-this-system-is)
- [The Moving Parts](#the-moving-parts)
- [Memory Lake System](#memory-lake-system)
- [Drives, Slots, and Link-Files](#drives-slots-and-link-files)
- [RAG as Artifact Reasoning](#rag-as-artifact-reasoning)
- [LeeMail Integration](#leemail-integration)
- [Communications Integration](#communications-integration)
- [Tools](#tools)
- [Security and Anti-Fraud](#security-and-anti-fraud)
- [Task Execution](#task-execution)
- [Backup and Restore](#backup-and-restore)
- [Operator Playbook](#operator-playbook)
- [Installation](#installation)
- [Development](#development)
- [License](#license)

---


---

## 🎯 What This System Is

**In one sentence:** Agent Lee is a local-first, policy-governed operating partner that reads and writes a structured, searchable, auditable Memory Lake—and then uses that Lake to run mail, communications, notes, tasks, and research as one connected workflow.

---


---

## 🏗️ The Moving Parts

Agent Lee is built as a single operating surface, not a collection of apps. There are five "organs" that cooperate:

### 1. The Memory Lake

A multi-drive local file system abstraction and evidence vault (the source of truth).

### 2. LeeMail / Email Center

Intake, summarize, classify, extract action items, and archive evidence into the Lake.

### 3. Communications Outlet

Phone, messages, video, contacts, quick notes, and shared files—all treated as Lake artifacts.

### 4. Policy + Settings

Zero-Egress defaults, capability gates (camera/mic/remote calls), and export/import controls.

### 5. Style Core

The human interface that keeps responses consistent, non-robotic, and operator-friendly.

---


---

## 💾 Memory Lake System

### The "State" of Agent Lee

The Memory Lake is not a chat transcript dump. It is the system's durable state and evidence layer.

When any module produces intelligence—an email summary, a call note, a task list, an attachment, a decision—the system writes a structured artifact into the Lake and signals the rest of the OS that the Lake changed.

**Key Principles:**

- State lives in the Lake; models are processors
- Every module is IO: it ingests signals and emits artifacts
- Every artifact can be re-opened, re-reviewed, re-processed, and exported

This is implemented as a shared Lake database plus a system-wide signal channel. Any write that matters posts a `LAKE_CHANGED` event so other modules can refresh and stay consistent.

---


---

## 🗂️ Drives, Slots, and Link-Files

### The 64GB Strategy

The Lake is organized as **8 drives** (L, E, O, N, A, R, D, and LEE). Each drive has **8 slots**. Each slot is treated as a **1GB unit** of storage.

**Total Capacity:** 8 drives × 8 slots × 1GB = **64GB of addressable Lake capacity**

The goal is not "infinite storage"; it is a predictable, portable, local vault.

### Drive Purposes

| Drive | Primary Purpose |
|-------|----------------|
| **L** | Learning, training data, mistake logs |
| **E** | Email, communications evidence |
| **O** | Operations, tasks, workflows |
| **N** | Notes, documentation, quick captures |
| **A** | Artifacts, media, attachments |
| **R** | Research, analysis, intelligence |
| **D** | Data, compliance, audit trails |
| **LEE** | Coordination drive (master index) |

### The LEE Drive

The **LEE drive** is the coordination drive: it is the master index and orchestration surface. The other drives are specialization lanes—where you separate categories of artifacts so retrieval is faster and corruption is easier to contain.

### Color-Coded Health

Colors are not aesthetic; they are health telemetry. Drives and slots show normal, suspect, quarantined, or blocked states:

- **🟢 Normal:** Healthy, trusted
- **🟡 Suspect:** Flagged for review
- **🟠 Quarantined:** Isolated, cannot interact
- **🔴 Blocked:** Corrupt, pending deletion

### Link-File Strategy

A critical saving strategy is the **link-file approach**: you can keep the Lake lean and still "mount" very large collections by saving a single 1GB container file on your device. Agent Lee keeps references to that file and treats it as if it is native capacity—without consuming the internal Lake quota.

**Think of this as:** A 64GB 'neural vault' with strict partitions, not a loose folder.

- Use drives to separate concerns: mail evidence is not stored like camera frames; compliance is not stored like drafts
- Use link-files when you want 'infinite recall' without bloating the active Lake: the Lake can be empty and still operate by indexing external containers

---


---

## 🔍 RAG as Artifact Reasoning

### Evidence, Not Vibes

Retrieval-Augmented Generation (RAG) in this system is not copy-paste context stuffing. It is **evidence-based reasoning over saved artifacts**.

### Agent Lee's RAG Loop

1. Ingest a signal
2. Save the artifact with timestamps and signatures
3. Embed it for semantic retrieval
4. Retrieve the most relevant artifacts later
5. Synthesize an answer
6. Write back the new conclusion as a new artifact—so the system improves over time

### Mistake Learning

The most important behavior: **errors and near-misses do not disappear**. They are stored as reference artifacts so Agent Lee can avoid repeating the same failure mode when a similar task appears again.

### What Gets Stored

Artifacts include:

- Summaries
- Action items
- Tasks
- Attachments
- Notes
- Call outcomes
- Decisions
- Policy events

**Key Points:**

- Embeddings provide 'similarity recall'
- Signatures provide 'integrity and lineage'
- Mistakes become training data for future task execution (locally, under your control)

---


---

## 📧 LeeMail Integration

### Email → Tasks → Evidence

LeeMail/Email Center is not just an inbox; it is an **intake organ**. It turns email streams into actionable intelligence and permanent evidence.

### How It Works

**When LeeMail summarizes unread streams:**

- Findings are logged into the Memory Lake so the summary is durable and reusable
- Ongoing interactions are logged—so the reasoning trail is auditable

**When you send email:**

- The transmission itself is written to the Lake (sent mail becomes an artifact)
- Attachments are captured as data and can be previewed or downloaded later
- The same content can be re-processed at any time to extract tasks or re-run analysis

### Lake Artifact Paths

- **Unread stream summaries:** `agent/summaries/` (Lake artifact)
- **Context messages and interaction traces:** `agent/interactions/` (Lake artifact)
- **Sent messages:** `leemail/sent/` (Lake artifact)
- **Extracted tasks:** `leemail/tasks/` (Lake artifact)
- **Attachments:** `leemail/attachments/` (Lake artifact)

Tasks can be loaded back out of `leemail/tasks/` to rebuild the operational stack after restart.

---


---

## 📱 Communications Integration

### Phone, Messages, Video, Contacts

Communications is built as a **unified handset surface**: Phone, Messages, Video, and Contacts share one shell so the OS can treat them as one continuous workflow.

### Quick Notes Integration

Quick Notes is part of the communications loop:

- A call or message can immediately become a note
- That note can become a task
- That task can become a scheduled action
- Every step becomes a Lake artifact

### File Sharing

File sharing inside communications (images, videos, docs) is treated as a first-class object:

- You can present it during a video call
- Preview it
- Store it into the Lake so it can be pulled back up later even if you stop using cloud services

### Structure

**Tabs:**

- Phone
- Messages
- Video
- Contacts

**Permissions:**

- Requests default handler + contacts + media access (camera/mic) so calls and FaceTime-like features work

**Shared Files:**

- Images/videos/docs can be uploaded and previewed
- The OS can later archive them for private-cloud retrieval

---


---

## 🛠️ Tools

### Voice, Vision, Research, Image Generation

Tools are how Agent Lee acts—not just talks. In this architecture, tools are **gated capabilities that produce artifacts**.

### Voice

- The system can accept microphone input and deliver spoken output
- Treated like an interaction channel whose transcripts and outcomes should be saved as Lake artifacts for continuity

### Vision

- The camera feed can be captured into images, then analyzed, then stored
- Agent Lee can both describe what's in the frame and later pull the exact frame back up for you

### Research

- Agent Lee can act as a research agent when policy allows network access
- The default stance is sovereignty: **Zero-Egress blocks remote API calls unless you override it**

### Image Generation

- When enabled, generated images are treated as deliverables
- Saved, re-openable, exportable, and attachable to mail, notes, or projects

---


---

## 🔐 Security and Anti-Fraud

### Zero-Egress Policy

Security here is **policy-first**. The default profile is **Zero-Egress**: remote calls are blocked unless you explicitly turn them on. This means the system is safe by default and only becomes networked by conscious choice.

### Sensor Permissions

Sensors (camera and microphone) are treated as explicit capabilities:

- Before the camera starts, policy is checked
- If it is blocked, the UI closes instead of silently capturing

### Email Safety

Email safety is enforced operationally:

- Suspicious or quarantined content is segregated
- Tasks extracted from risky mail are flagged
- Attachments are not treated as trusted
- The Lake becomes the audit trail for what was received, what was decided, and what was executed

### Corruption Defense

Corruption defense is a core promise of the Lake. Agent Lee can:

- Scan for corrupt artifacts
- Isolate them
- Delete them—whether the corruption is one file or a full branch

If corruption attempts to replicate across drives, the OS treats that as a **containment event**:

1. Identify lineage
2. Cut links
3. Purge copies
4. Write an incident report back to the Lake

### Security Summary

- **Default security posture:** Block remote LLM/embedding/TTS unless overridden
- **Explicit sensor gating:** Camera/mic require policy approval at runtime
- **Integrity operations:** Signatures + timestamps + lineage tracking
- **Containment operations:** Quarantine, isolate, delete, verify, and document

---


---

## ⚙️ Task Execution

### Short-Term vs Long-Term

Agent Lee manages two timelines at once:

- **Short-term execution:** What must happen next
- **Long-term continuity:** What must remain true over time

The Lake is how those timelines are negotiated safely.

### Short-Term Tasks

Created from signals: mail action items, call outcomes, operator notes, research findings.

- Live in a queue
- Always linked to evidence artifacts so nothing becomes an orphan 'to-do' with no context

### Long-Term Threads

Maintained as 'project lanes' inside the Lake:

- Recurring responsibilities
- Training programs
- Compliance workflows
- Billing cycles
- Ongoing relationships

These are not just notes—they are structured archives that can regenerate the current operational picture after any restart.

### Resolution

Resolution is a state change:

- When a task is completed, the completion is written to the Lake along with what was done and why
- That is how the system learns and how you prove work later

### Execution Summary

- Every task links back to evidence (emails, calls, notes, attachments)
- Every completion writes a durable closure artifact
- Every mistake becomes a reference artifact to reduce future errors

---


---

## 💾 Backup and Restore

### Operator-Responsibility Model

You built an operator-responsibility model: **browsers can clear storage, so exports are not optional—they are survival**.

### Export/Import

The OS supports export/import capabilities as gated filesystem operations:

- When you export, you are creating portable shards of the Lake (or external container files)
- Your private cloud can move with you

### Reprocessing

Because artifacts are stored in structured form, you can **reprocess** them:

- A photo can be re-analyzed
- A PDF's text can be re-summarized
- An email thread can be re-scanned for missed action items
- A call note can be re-linked to a project drive

### The Private Cloud Outcome

Your media and documents are not hostage to third-party services. You can always pull them back up locally, with the reasoning trail intact.

### Backup Discipline

- **Export discipline:** Schedule regular exports; treat them like backups
- **Import discipline:** Bring shards back in on new devices; rebuild the full OS state
- **Reprocessing discipline:** Revisit old artifacts to extract new value without re-doing the work

---


---

## 📖 Operator Playbook

### Saving Strategy + Operating Discipline

If you want Agent Lee to feel like a real operating partner, the operator must treat the Lake like a real filing system and evidence vault.

### Use Drives Intentionally

- Keep the LEE drive clean and authoritative
- Do not mix high-risk artifacts into trusted drives
- Mark suspect items immediately so the system can route analysis safely

### Use Link-Files for Scale

- Store large media collections in external 1GB containers
- Keep pointers in the Lake
- Let Agent Lee index and retrieve them as if they were internal

### Handle Corruption Immediately

When corruption is detected, do not 'ignore it':

1. Trigger a scan
2. Isolate the branch
3. Purge the bad lineage
4. Write an incident report artifact

That incident becomes future defense.

### Daily Routine

- Summarize unread mail → log summary to Lake → extract tasks → prioritize

### Weekly Routine

- Export Lake shards and link-file containers

### Monthly Routine

- Run integrity scans
- Purge trash and stale caches
- Verify backups restore cleanly

### Always

- Keep Zero-Egress on unless you are actively running a trusted remote workflow

---


---

## 🚀 Installation

### Quick Start (GitHub)

To push this project to your repository:

```bash
git init
git add .
git commit -m "Initialize Agent Lee v38.0 Agentic OS"
git branch -M main
git remote add origin https://github.com/4citeB4U/AgenticOperatingSystem.git
git push -u origin main
```text

### Browser Requirements

- Modern browser with WebGPU support (Chrome 113+, Edge 113+)
- Minimum 8GB RAM recommended
- GPU with 4GB+ VRAM for optimal performance

### First Run

1. Open `index.html` in a WebGPU-capable browser
2. Grant necessary permissions when prompted (camera/mic/contacts)
3. Configure Zero-Egress policy in Settings
4. Initialize Memory Lake drives
5. Import any existing data shards

---


---

## 💻 Development

### Local Development

```bash
# Install dependencies (if any)
npm install

# Start development server
npm run dev

# Build for production
npm run build
```text

### Project Structure

```text

/
├── index.html              # Single-file monolith entry point
├── package.json           # Dependencies (minimal)
├── README.md              # This file
└── docs/                  # Additional documentation

```

### Neural Architecture

#### WebGPU 4-Bit Core

Lee uses a high-velocity **WebGPU Pipeline**:

- **Quantization:** Q4 (4-bit) weights to fit models (`Qwen`, `Phi-3`) into consumer VRAM
- **KV-Cache Optimization:** Persists context in GPU memory for fast conversation turns
- **Local Inference:** All AI processing happens on your hardware

#### The LEONARD LEE Vault

Custom encrypted file system built on IndexedDB:

- **Structure:** 8 Drives × 8 Slots = 64 Secure Memory Banks
- **Capacity:** 64GB addressable
- **Expansion:** Link-file containers for infinite scale

---

---

## 🌟 The Manifesto

Agent Lee represents a return to computational sovereignty. In an era where "the cloud" means "someone else's computer," we offer a different path:

**We do not connect you to the world.**  
**We give you dominion over your own.**

This is not a rejection of connectivity—it is an insistence on _intentional_ connectivity. Agent Lee defaults to isolation and opens channels only when you command it.

This is not a rejection of AI—it is a reclamation of _local_ AI. Your Agentic Operating System lives in your memory heap, thinks with your GPU, and remembers in your filesystem.

**Status:** ONLINE  
**Build Date:** December 19, 2025  
**Governance:** Zero-Egress (Strict)

> _"The future of AI is not in the cloud—it's in your hands."_  
> **— Leeway Industries**

---

---

## 📄 License

**SPDX-License-Identifier:** MIT

Agent Lee v38.0 is released under the MIT License. Your instance, your data, your control.

---

_Built with sovereignty. Powered by WebGPU. Governed by you._
