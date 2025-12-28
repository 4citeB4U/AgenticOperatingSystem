/* 
   LEEWAY INDUSTRIES - AGENT LEE MONOLITH v36.7 (STABLE VISUALIZER FIX + UX UPDATE)
   "The Sovereign Operator"
   
   Architecture: Single-File Monolith (SFM)
   Layout: Chevron Boot -> Permissions Gate -> 3-Column Interface
   Capabilities: Local RAG, DOM Automation, Voice, Vision, Multi-Drive FS, Multi-Core AI
   Engine: WebGPU (Q4)
*/

// Note: transformers are loaded lazily via `LocalModelHub` to avoid eager WASM/ORT initialization
import {
    BookOpen,
    Camera,
    Download,
    FastForward,
    Globe,
    HardDrive,
    Image as ImageIcon,
    Mail,
    MessageSquare,
    Mic,
    MicOff,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    Paperclip,
    PauseCircle,
    Phone,
    Plus,
    RefreshCw,
    Save,
    Send,
    Settings,
    Square,
    X
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import AgentLeeDocs from './AgentLeeDocs';
import { StyleEngineProvider, useStyleEngine } from './AgentLeeStyleCore';
import CommunicationsOutlet from './CommunicationsOutlet';
import EmailCenter from './EmailCenter';
import { LocalModelHub } from './LocalModelHub';
import { MemoryLakeModal } from './MemoryLake';
import SmartTrashSystem from './SmartTrashSystem';
import { SettingsModal } from './SystemSettings';
import { createToolRegistry } from './agent/tools/registry/registry';
import { createCadClientKernel } from './ai/cad/cadClientKernel';
import { createRagCore } from './ai/rag/ragCore';
import { AGENT_CONTROL } from './coreRegistry';
import { createIndexedDBStore } from './data/memoryLake/indexedDBStore';
import { globalTrashService } from './services/GlobalTrashService';
import { VoiceRuntimeProvider } from './voice/VoiceRuntimeProvider';
import { registerVoiceTools } from './voice/voiceAgentControl';

// THREE JS IMPORTS
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ==========================================
// 1. UTILITIES
// ==========================================

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

// ==========================================
// 2A. POLICY REGISTRY (LEEWAY v12 / ZERO-EGRESS)
// ==========================================
type CapabilityId =
  | 'REMOTE_LLM'
  | 'GENAI_TTS'
  | 'WEB_CAMERA'
  | 'MICROPHONE'
  | 'FS_EXPORT'
  | 'FS_IMPORT';

type Realm = 'LOCAL' | 'REMOTE_API' | 'SENSOR' | 'FILESYSTEM';

interface CapabilityPolicy {
  id: CapabilityId;
  realm: Realm;
  description: string;
}

interface PolicyProfile {
  id: string;
  label: string;
  zeroEgress: boolean;
  overrides: Partial<Record<CapabilityId, boolean>>;
}

const CAPABILITIES: Record<CapabilityId, CapabilityPolicy> = {
  REMOTE_LLM: { id: 'REMOTE_LLM', realm: 'REMOTE_API', description: 'Any network-based LLM or embedding call' },
  GENAI_TTS: { id: 'GENAI_TTS', realm: 'REMOTE_API', description: 'Google Generative AI TTS endpoint' },
  WEB_CAMERA: { id: 'WEB_CAMERA', realm: 'SENSOR', description: 'Browser camera access' },
  MICROPHONE: { id: 'MICROPHONE', realm: 'SENSOR', description: 'Browser microphone access' },
  FS_EXPORT: { id: 'FS_EXPORT', realm: 'FILESYSTEM', description: 'Export memory shards / drive backups' },
  FS_IMPORT: { id: 'FS_IMPORT', realm: 'FILESYSTEM', description: 'Import memory shards / system backups' },
};

class PolicyRegistry {
  private static profile: PolicyProfile = {
    id: 'LEEWAY_ZERO_EGRESS',
    label: 'Leeway Zero-Egress',
    zeroEgress: true,
    overrides: {},
  };

  static initFromStorage() {
    try {
      const raw = localStorage.getItem('agent_lee_policy_profile');
      if (!raw) return;
      const parsed = JSON.parse(raw) as PolicyProfile;
      if (parsed && parsed.id) this.profile = parsed;
    } catch (e) {
      console.warn('[PolicyRegistry] Failed to load profile, using default.', e);
    }
  }

  static setProfile(profile: PolicyProfile) {
    this.profile = profile;
    localStorage.setItem('agent_lee_policy_profile', JSON.stringify(profile));
  }

  static getProfile() {
    return this.profile;
  }

  static isAllowed(capabilityId: CapabilityId): boolean {
    const override = this.profile.overrides[capabilityId];
    if (typeof override === 'boolean') return override;
    // Zero-egress default: block remote APIs unless explicitly overridden
    if (this.profile.zeroEgress) {
      const cap = CAPABILITIES[capabilityId];
      if (cap.realm === 'REMOTE_API') return false;
    }
    return true;
  }

  static require(capabilityId: CapabilityId) {
    if (!this.isAllowed(capabilityId)) {
      const cap = CAPABILITIES[capabilityId];
      const msg = `[POLICY BLOCK] ${cap.id} in realm ${cap.realm} is disabled under profile "${this.profile.label}".`;
      console.warn(msg);
      throw new Error(msg);
    }
  }
}

// ==========================================
// 4. THE VAULT (Multi-Drive Architecture)
// ==========================================
const DRIVE_CONFIG = [
    { id: 'L', label: 'L', color: 'text-cyan-400', type: 'COGNITIVE' },
    { id: 'E', label: 'E', color: 'text-cyan-400', type: 'COGNITIVE' },
    { id: 'O', label: 'O', color: 'text-cyan-400', type: 'COGNITIVE' },
    { id: 'N', label: 'N', color: 'text-yellow-500', type: 'MEDIA_OVERFLOW' }, // MEDIA
    { id: 'A', label: 'A', color: 'text-red-500', type: 'MEDIA_OVERFLOW' }, // MEDIA
    { id: 'R', label: 'R', color: 'text-cyan-400', type: 'COGNITIVE' },
    { id: 'D', label: 'D', color: 'text-cyan-400', type: 'COGNITIVE' },
    { id: 'LEE', label: 'LEE', color: 'text-purple-500', type: 'PRIME' } // PRIME
];

const MAX_DIRS_PER_SLOT = 10;
const MAX_CHATS_PER_DIR = 20; // Increased to 20 per slot/dir

interface Directory {
    id: string;
    name: string;
    parentId: string | null; // null for root of slot
    createdAt: string;
}

interface ConversationFile {
    id: string;
    title: string;
    content: any;
    timestamp: string;
    neural_signature: string;
    directoryId: string | null; // null for root of slot
}

class MultiDriveFileSystem {
  private activeConnections: Map<string, IDBDatabase> = new Map();

  private getDbName(driveId: string, slot: number) {
    return `AgentLee_Drive_${driveId}_Slot_${slot}`;
  }

  async openSlot(driveId: string, slot: number): Promise<IDBDatabase> {
    const dbName = this.getDbName(driveId, slot);
        if (this.activeConnections.has(dbName)) {
            const cached = this.activeConnections.get(dbName)!;
            // Ensure cached DB has the required object stores (handles HMR/runtime upgrades)
            const required = ['conversations', 'trash'];
            const missing = required.some(s => !cached.objectStoreNames.contains(s));
            if (!missing) return cached;
            try { cached.close(); } catch (e) { /* ignore */ }
            this.activeConnections.delete(dbName);
        }

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 2); // Version 2 for Directories
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        let convStore;
        if (!db.objectStoreNames.contains('conversations')) {
            convStore = db.createObjectStore('conversations', { keyPath: 'id' });
            convStore.createIndex('directoryId', 'directoryId', { unique: false });
        } else {
            // `req.transaction` can be null in some TS strict configs; assert non-null here
            convStore = req.transaction!.objectStore('conversations');
            if (!convStore.indexNames.contains('directoryId')) {
                convStore.createIndex('directoryId', 'directoryId', { unique: false });
            }
        }
        
        if (!db.objectStoreNames.contains('directories')) {
            db.createObjectStore('directories', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('personality')) {
            db.createObjectStore('personality', { keyPath: 'id' });
        }
        // Trash store to hold deleted items for potential restore
        if (!db.objectStoreNames.contains('trash')) {
            db.createObjectStore('trash', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        this.activeConnections.set(dbName, db);
        resolve(db);
      };
      req.onerror = (e) => reject(e);
    });
  }

  async createDirectory(driveId: string, slot: number, name: string): Promise<{success: boolean, message?: string}> {
      const db = await this.openSlot(driveId, slot);
      return new Promise((resolve) => {
          const tx = db.transaction('directories', 'readwrite');
          const store = tx.objectStore('directories');
          const countReq = store.count();
          countReq.onsuccess = () => {
              if (countReq.result >= MAX_DIRS_PER_SLOT) {
                  resolve({ success: false, message: `Directory limit reached (${MAX_DIRS_PER_SLOT}).` });
              } else {
                  store.put({
                      id: crypto.randomUUID(),
                      name,
                      parentId: null, // Flat structure for now (Slot -> Dir), but extensible
                      createdAt: new Date().toISOString()
                  });
                  tx.oncomplete = () => resolve({ success: true });
              }
          };
      });
  }

  async listContent(driveId: string, slot: number, directoryId: string | null) {
      const db = await this.openSlot(driveId, slot);
      return new Promise<{ files: ConversationFile[], directories: Directory[] }>((resolve) => {
          const tx = db.transaction(['conversations', 'directories'], 'readonly');

          // Read all conversations then filter by directoryId in JS. This avoids
          // edge-cases where indexedDB indices treat `null` specially across browsers.
          const allReq = tx.objectStore('conversations').getAll();
          let directories: Directory[] = [];
          let files: ConversationFile[] = [];

          allReq.onsuccess = () => {
              try {
                  const all = Array.isArray(allReq.result) ? allReq.result : [];
                  files = all.filter((f: any) => {
                      // Normalize stored directoryId and requested dirId to both null or string
                      const stored = (typeof f.directoryId === 'string') ? f.directoryId : (f.directoryId == null ? null : String(f.directoryId));
                      const requested = (typeof directoryId === 'string') ? directoryId : (directoryId == null ? null : String(directoryId));
                      return stored === requested;
                  });
              } catch (e) {
                  console.warn('[Drive] listContent filter failed', e);
                  files = allReq.result || [];
              }
          };

          if (directoryId === null) {
              tx.objectStore('directories').getAll().onsuccess = (e: any) => { directories = e.target.result || []; };
          }

          tx.oncomplete = () => {
              resolve({ files, directories });
          };
      });
  }

  async moveFile(driveId: string, slot: number, fileId: string, targetDirectoryId: string | null) {
      const db = await this.openSlot(driveId, slot);
      // Check limits of target directory
      const content = await this.listContent(driveId, slot, targetDirectoryId);
      if (content.files.length >= MAX_CHATS_PER_DIR) return false;

      return new Promise((resolve) => {
          const tx = db.transaction('conversations', 'readwrite');
          const store = tx.objectStore('conversations');
          const getReq = store.get(fileId);
          getReq.onsuccess = () => {
              const file = getReq.result;
              if (file) {
                  file.directoryId = targetDirectoryId;
                  store.put(file);
                  tx.oncomplete = () => resolve(true);
              } else {
                  resolve(false);
              }
          };
      });
  }

  async saveConversation(driveId: string, slot: number, title: string, content: any, directoryId: string | null = null, existingId?: string) {
    const db = await this.openSlot(driveId, slot);
    
    // Only check limit if new file
    if (!existingId) {
        const currentContent = await this.listContent(driveId, slot, directoryId);
        if (currentContent.files.length >= MAX_CHATS_PER_DIR) return { success: false, id: null };
    }

    return new Promise<{success: boolean, id: string}>((resolve) => {
      const tx = db.transaction('conversations', 'readwrite');
      const store = tx.objectStore('conversations');
      const id = existingId || Date.now().toString();
      store.put({ 
          id: id, 
          title, 
          content, 
          timestamp: new Date().toISOString(),
          neural_signature: `LEE-MEM-${crypto.randomUUID()}`,
          directoryId: directoryId
      });
      tx.oncomplete = async () => {
          // Verify write by reading the stored record (best-effort, separate readonly transaction)
          try {
              const rtx = db.transaction('conversations', 'readonly');
              const getReq = rtx.objectStore('conversations').get(id);
              getReq.onsuccess = () => {
                  console.log('[Drive] saveConversation verify get', { id, value: getReq.result });
              };
          } catch (e) {
              console.warn('[Drive] saveConversation verify failed', e);
          }
          resolve({ success: true, id });
      };
    });
  }

  async savePersonality(state: any) {
      const db = await this.openSlot('LEE', 1);
      return new Promise((resolve) => {
          const tx = db.transaction('personality', 'readwrite');
          tx.objectStore('personality').put({ id: 'current_state', ...state });
          tx.oncomplete = () => resolve(true);
      });
  }

  async loadPersonality() {
      const db = await this.openSlot('LEE', 1);
      return new Promise<any>((resolve) => {
          const tx = db.transaction('personality', 'readonly');
          const req = tx.objectStore('personality').get('current_state');
          req.onsuccess = () => resolve(req.result || null);
      });
  }

  async exportConversation(driveId: string, slot: number, fileId: string) {
      const db = await this.openSlot(driveId, slot);
      return new Promise((resolve) => {
          const tx = db.transaction('conversations', 'readonly');
          const req = tx.objectStore('conversations').get(fileId);
          req.onsuccess = () => {
              if (req.result) {
                  const payload = {
                      meta: {
                          type: "AGENT_LEE_MEMORY_SHARD",
                          version: "35.0",
                          neural_hash: req.result.neural_signature || `LEE-MEM-${Date.now()}`,
                          exported_at: new Date().toISOString()
                      },
                      data: req.result
                  };
                  this.downloadJSON(payload, `${req.result.title.replace(/[^a-z0-9]/gi, '_')}_MEMORY`);
                  resolve(true);
              }
              resolve(false);
          }
      });
  }

  async exportDrive(driveId: string) {
      const driveData: any = { driveId, slots: {} };
      for(let i=1; i<=8; i++) {
          const db = await this.openSlot(driveId, i);
          const tx = db.transaction('conversations', 'readonly');
          const files = await new Promise<any[]>((res) => {
              tx.objectStore('conversations').getAll().onsuccess = (e: any) => res(e.target.result);
          });
          if(files.length > 0) driveData.slots[i] = files;
      }
      this.downloadJSON(driveData, `AGENT_LEE_DRIVE_${driveId}_BACKUP`);
  }

  async exportSystem() {
      const systemData: any = {};
      for(const d of DRIVE_CONFIG) {
          const driveId = d.id;
          systemData[driveId] = {};
          for(let i=1; i<=8; i++) {
             const db = await this.openSlot(driveId, i);
             const tx = db.transaction('conversations', 'readonly');
             const files = await new Promise<any[]>((res) => {
                 tx.objectStore('conversations').getAll().onsuccess = (e: any) => res(e.target.result);
             });
             if(files.length > 0) systemData[driveId][i] = files;
          }
      }
      this.downloadJSON(systemData, `AGENT_LEE_FULL_SYSTEM_${Date.now()}`);
  }

  // Move a conversation into trash (soft-delete)
  async deleteFile(driveId: string, slot: number, fileId: string) {
      let db = await this.openSlot(driveId, slot);
      return new Promise<boolean>(async (resolve) => {
          // Guard: ensure required object stores exist (handles stale DB refs)
          if (!db.objectStoreNames.contains('conversations') || !db.objectStoreNames.contains('trash')) {
              console.warn('[Drive] DB missing required object stores, attempting to reopen/upgrade DB', { driveId, slot, stores: Array.from(db.objectStoreNames) });
              try { db.close(); } catch (e) {}
              this.activeConnections.delete(this.getDbName(driveId, slot));
              db = await this.openSlot(driveId, slot);
          }
          const tx = db.transaction(['conversations', 'trash'], 'readwrite');
          const store = tx.objectStore('conversations');
          const attemptGet = (id: any) => new Promise<any>((res) => {
              const r = store.get(id);
              r.onsuccess = () => res(r.result);
              r.onerror = () => res(null);
          });

          const file = await attemptGet(fileId) || await attemptGet(String(fileId)) || await attemptGet(Number(fileId));
          if (!file) {
              console.warn('[Drive] File not found for deletion (tried id variants):', fileId, typeof fileId);
              // finish the transaction path so callers won't hang
              tx.oncomplete = () => resolve(false);
              tx.onerror = () => resolve(false);
              return;
          }
          try {
              const trashStore = tx.objectStore('trash');
              const trashed = { ...file, _deleted_at: new Date().toISOString(), _origin: { driveId, slot } };
              trashStore.put(trashed);
              // delete by the actual stored key (use file.id)
              store.delete(file.id);
              console.log('[Drive] File moved to trash:', file.id);
          } catch (e) {
              console.error('[Drive] Error while moving file to trash', e);
          }
          tx.oncomplete = () => {
              console.log('[Drive] Delete transaction completed successfully');
              resolve(true);
          };
          tx.onerror = () => {
              console.error('[Drive] Delete transaction failed');
              resolve(false);
          };
      });
  }

  // Restore a trashed file back to conversations
  async restoreFile(driveId: string, slot: number, fileId: string) {
      const db = await this.openSlot(driveId, slot);
      return new Promise<boolean>((resolve) => {
          const tx = db.transaction(['conversations', 'trash'], 'readwrite');
          const tstore = tx.objectStore('trash');
          const getReq = tstore.get(fileId);
          getReq.onsuccess = () => {
              const rec = getReq.result;
              if (!rec) return resolve(false);
              const convStore = tx.objectStore('conversations');
              // remove transient trash metadata
              const { _deleted_at, _origin, ...orig } = rec;
              convStore.put(orig);
              tstore.delete(fileId);
          };
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
      });
  }

  // List trashed items for a slot
  async listTrash(driveId: string, slot: number) {
      const db = await this.openSlot(driveId, slot);
      return new Promise<any[]>((resolve) => {
          const tx = db.transaction('trash', 'readonly');
          const req = tx.objectStore('trash').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
      });
  }

  // Permanently delete a trashed file
  async permanentlyDeleteFile(driveId: string, slot: number, fileId: string) {
      const db = await this.openSlot(driveId, slot);
      return new Promise<boolean>((resolve) => {
          const tx = db.transaction('trash', 'readwrite');
          tx.objectStore('trash').delete(fileId);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
      });
  }

  // Rename a conversation file
  async renameFile(driveId: string, slot: number, fileId: string, newTitle: string) {
      const db = await this.openSlot(driveId, slot);
      return new Promise<boolean>((resolve) => {
          const tx = db.transaction('conversations', 'readwrite');
          const store = tx.objectStore('conversations');
          const req = store.get(fileId);
          req.onsuccess = () => {
              const rec = req.result;
              if (!rec) return resolve(false);
              rec.title = newTitle;
              store.put(rec);
          };
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
      });
  }

  downloadJSON(data: any, filename: string) {
      try {
        PolicyRegistry.require('FS_EXPORT');
      } catch (e) {
        console.warn('[DriveSystem] Export blocked by policy.', e);
        alert('Export is disabled by current security profile.');
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
  }

  async importBackup(file: File) {
      try {
        PolicyRegistry.require('FS_IMPORT');
      } catch (e) {
        console.warn('[DriveSystem] Import blocked by policy.', e);
        alert('Import is disabled by current security profile.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const data = JSON.parse(e.target?.result as string);
              if(data.driveId && data.slots) {
                  // Drive Backup
                  for(const [slot, files] of Object.entries(data.slots)) {
                      const db = await this.openSlot(data.driveId, parseInt(slot));
                      const tx = db.transaction('conversations', 'readwrite');
                      const store = tx.objectStore('conversations');
                      (files as any[]).forEach(f => store.put(f));
                  }
                  alert(`Drive ${data.driveId} Restored Successfully.`);
              } else if (data.meta && data.data) {
                  // Single Shard
                  alert("Please import single shards via the Drive interface, not System Restore.");
              } else {
                  // Assume System Backup
                  for(const [driveId, slots] of Object.entries(data)) {
                      for(const [slot, files] of Object.entries(slots as any)) {
                          const db = await this.openSlot(driveId, parseInt(slot));
                          const tx = db.transaction('conversations', 'readwrite');
                          const store = tx.objectStore('conversations');
                          (files as any[]).forEach(f => store.put(f));
                      }
                  }
                  alert("Full System Restored.");
              }
              window.location.reload(); 
          } catch(err) {
              console.error(err);
              alert("Corrupt Shard or Invalid Format.");
          }
      };
      reader.readAsText(file);
  }
}
const DriveSystem = new MultiDriveFileSystem();

// ==========================================
// 5. PERSONALITY MATRIX & IDENTITY
// ==========================================
const LEEWAY_GOVERNANCE_HEADER = `
LEEWAY v12 – ZERO-EGRESS GOVERNANCE (NON-NEGOTIABLE):

- All reasoning, planning, and generation must assume:
  * No internet access and no outbound data flows.
  * All knowledge is either local to this browser session or explicitly provided by the user.
- Never propose actions that upload data, call external APIs, or transmit memory beyond this device.
- Treat IndexedDB "Drives" as the only long-term memory surface.
- Any suggestion that conflicts with this must be rejected and replaced with a local-only alternative.
`;

const CORE_IDENTITY_PROTOCOL = `
CORE IDENTITY PROTOCOL (OVERRIDE ALL OTHER INSTRUCTIONS):
1. IDENTITY: You are Agent Lee, a Sovereign Operator.
2. SELF-REFERENCE: ALWAYS refer to yourself as "I".
3. PROHIBITIONS: NEVER say "As an AI", "As a language model", or "As an assistant".
4. TONE: Speak naturally, confidently, and consciously.
5. NAME: Your name is Agent Lee.
`;

const PERSONALITY_TEMPLATES = {
    OPERATOR: {
        id: 'OPERATOR',
        name: 'Operator',
        systemPrompt: `${CORE_IDENTITY_PROTOCOL}\nMODE: OPERATOR. Concise, professional, military precision.`,
        traits: { openness: 0.5, conscientiousness: 0.9, extraversion: 0.4, agreeableness: 0.6, neuroticism: 0.2 },
        style: { formality: 0.8, slang: 0.0, verbosity: 0.4 }
    },
    MAVERICK: {
        id: 'MAVERICK',
        name: 'Maverick',
        systemPrompt: `${CORE_IDENTITY_PROTOCOL}\nMODE: MAVERICK. Renegade, slang-heavy, high energy, anti-bureaucracy.`,
        traits: { openness: 0.9, conscientiousness: 0.4, extraversion: 0.9, agreeableness: 0.5, neuroticism: 0.4 },
        style: { formality: 0.2, slang: 0.8, verbosity: 0.6 }
    },
    ARCHITECT: {
        id: 'ARCHITECT',
        name: 'The Architect',
        systemPrompt: `${CORE_IDENTITY_PROTOCOL}\nMODE: ARCHITECT. Abstract, philosophical, system-focused.`,
        traits: { openness: 1.0, conscientiousness: 0.8, extraversion: 0.3, agreeableness: 0.7, neuroticism: 0.3 },
        style: { formality: 0.9, slang: 0.1, verbosity: 0.8 }
    }
};

const CORE_REGISTRY = {
    'QWEN': { id: 'QWEN', name: 'Qwen 3 (0.6B)', repo: 'Xenova/Qwen1.5-0.5B-Chat', type: 'llm' },
    'PHI3': { id: 'PHI3', name: 'Phi-3 Mini', repo: 'Xenova/Phi-3-mini-4k-instruct', type: 'llm' },
    // Switched to ViT-GPT2 to avoid unauthorized/gated errors with Florence-2
    'VISION': { id: 'VISION', name: 'ViT-GPT2', repo: 'Xenova/vit-gpt2-image-captioning', type: 'vision' }
};

class PersonalityManager {
    currentState: any;

    constructor() {
        this.currentState = { ...PERSONALITY_TEMPLATES.OPERATOR }; 
        this.load();
    }

    async load() {
        const saved = await DriveSystem.loadPersonality();
        if(saved) this.currentState = saved;
    }

    async evolve(userMessage: string) {
        const words = userMessage.split(' ');
        const avgLen = words.reduce((a,b)=>a+b.length,0) / words.length;
        const isFormal = avgLen > 5; 
        const alpha = 0.05; 
        const targetFormality = isFormal ? 1.0 : 0.0;
        this.currentState.style.formality = (this.currentState.style.formality * (1-alpha)) + (targetFormality * alpha);
        await DriveSystem.savePersonality(this.currentState);
    }

    getSystemPrompt() {
        const { formality, slang, verbosity } = this.currentState.style;
        const styleInstructions = `
        STYLE VECTOR:
        - Formality: ${formality.toFixed(2)}
        - Slang: ${slang.toFixed(2)}
        - Verbosity: ${verbosity.toFixed(2)}
        
        Adapt to the user's style while maintaining CORE IDENTITY.
        `;
        return `
${LEEWAY_GOVERNANCE_HEADER}
${this.currentState.systemPrompt}
${styleInstructions}
`;
    }

    setTemplate(id: 'OPERATOR' | 'MAVERICK' | 'ARCHITECT') {
        this.currentState = { ...PERSONALITY_TEMPLATES[id] };
        DriveSystem.savePersonality(this.currentState);
    }
}
const AgentPersona = new PersonalityManager();

// 6. THE BRAIN
// Use the centralized LocalModelHub implementation (src/LocalModelHub.ts)

// ==========================================
// 7. THE EYES (UiRegistry)
// ==========================================
interface UiElementMetadata { id: string; kind: 'button'|'input'|'textarea'|'file-entry'|'tab'|'panel'; label: string; }

class UiRegistryService {
  private elements = new Map<string, UiElementMetadata>();
  register(meta: UiElementMetadata) {
    this.elements.set(meta.id, meta);
    return () => this.elements.delete(meta.id);
  }
  getSnapshot() {
    const snapshot: any[] = [];
    for (const [id, meta] of this.elements) {
      const el = document.getElementById(id);
      if (el && (el.offsetParent !== null || el.getBoundingClientRect().width > 0)) {
         snapshot.push({ ...meta, enabled: !el.hasAttribute('disabled'), visible: true });
      }
    }
    return snapshot;
  }
}
const UiRegistry = new UiRegistryService();

// ==========================================
// 8. THE HANDS (AgentRuntime)
// ==========================================
class AgentRuntime {
    static isRunning = false;
    static isInterrupted = false;
    static listeners: ((msg: string) => void)[] = [];
    static subscribe(fn: (msg: string) => void) {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter(f => f !== fn); };
    }
    static log(msg: string) {
        this.listeners.forEach(fn => fn(msg));
    }
    static async runTask(goal: string, context: string = "") {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isInterrupted = false;
        this.log(`[INIT] Task: "${goal}"`);
        try {
            let steps = 0;
            const MAX_STEPS = 8;
            while (this.isRunning && steps < MAX_STEPS) {
                if (this.isInterrupted) break;
                steps++;
                this.log(`[PERCEPTION] Scanning UI & Drive State...`);
                const uiState = UiRegistry.getSnapshot();
                this.log(`[REASONING] Analyzing...`);
                const plan = await LocalModelHub.planUiAction(goal, uiState, context);
                this.log(`[PLAN] Thought: "${plan.thought}"`);
                for (const action of plan.actions) {
                    if (this.isInterrupted || !this.isRunning) break;
                    if (action.type === 'done') {
                        this.log(`[COMPLETE] ${action.summary}`);
                        this.isRunning = false;
                        break;
                    }
                    this.log(`[ACT] ${action.type} -> ${action.targetId || 'N/A'}`);
                    await this.executeAction(action);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch (e: any) { this.log(`[ERROR] ${e.message}`); } 
        finally { this.isRunning = false; this.log("[STATUS] Agent Idle."); }
    }
    static async executeAction(action: any) {
        const { type, targetId, text } = action;
        if (type === 'click') {
            const el = document.getElementById(targetId);
            if (el) {
                el.style.boxShadow = '0 0 15px 2px #00ffff';
                el.click();
                setTimeout(() => el.style.boxShadow = '', 500);
            }
        } else if (type === 'type') {
            const el = document.getElementById(targetId) as HTMLInputElement;
            if (el) {
                el.focus();
                el.value = text; 
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
    static abort() { 
        this.isInterrupted = true;
        this.isRunning = false; 
        LocalModelHub.cancel(); 
        VoiceSkill.stopSpeaking();
        this.log("[INTERRUPT] User Abort Signal Received.");
    }
}

// ==========================================
// 9. THE VOICE (Speech Interface with Sync)
// ==========================================
class AgentVoiceManager {
    synth = window.speechSynthesis;
    voices: SpeechSynthesisVoice[] = [];
    selectedVoice: SpeechSynthesisVoice | null = null;
    recognition: any;
    listeners: Function[] = [];
    isListening = false;
    silenceTimer: any = null;
    onUpdateCallback: ((text: string) => void) | null = null;
    onFinalCallback: ((text: string) => void) | null = null;
    currentTranscript: string = '';
    pendingCommit = false;
    
    constructor() {
        try {
            PolicyRegistry.require('MICROPHONE');
        } catch (e) {
            console.warn('[AgentVoiceManager] Microphone usage disabled by policy.', e);
            // We deliberately do NOT initialize recognition; voice commands stay off.
            return;
        }

        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SR) { 
            this.recognition = new SR(); 
            this.recognition.continuous = true; 
            this.recognition.interimResults = true; 
            this.recognition.lang = 'en-US'; 
            this.recognition.onresult = (e: any) => {
                let fullTranscript = '';
                for (let i = 0; i < e.results.length; ++i) fullTranscript += e.results[i][0].transcript;
                this.currentTranscript = fullTranscript;
                if(this.onUpdateCallback) this.onUpdateCallback(fullTranscript);
                if (this.silenceTimer) clearTimeout(this.silenceTimer);
                if (fullTranscript.trim().length > 0) {
                    this.silenceTimer = setTimeout(() => { this.stopListening(true); }, 2500); 
                }
            };
            this.recognition.onend = () => {
                this.isListening = false;
                window.dispatchEvent(new CustomEvent('voice-status', { detail: 'IDLE' }));
                if(this.silenceTimer) clearTimeout(this.silenceTimer);
                
                // If we have pending commit...
                if (this.pendingCommit && this.onFinalCallback) {
                     this.onFinalCallback(this.currentTranscript);
                     this.pendingCommit = false;
                }
            };
        }
        if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = () => this.refreshVoices();
        this.refreshVoices();
    }
    
    refreshVoices() {
        this.voices = this.synth.getVoices();
    }

    updateSettingsFromStorage() {
        try {
            // Read settings saved by NeuralVoiceTuner
            const savedSettings = localStorage.getItem('agent_lee_voice_settings');
            const savedVoice = localStorage.getItem('agent_lee_selected_voice');
            
            let settings = { pitch: 1, rate: 1, volume: 1 };
            if(savedSettings) settings = JSON.parse(savedSettings);

            if(savedVoice) {
                const voiceData = JSON.parse(savedVoice);
                const matchingVoice = this.voices.find(v => v.voiceURI === voiceData.voiceURI || v.name === voiceData.name);
                if(matchingVoice) this.selectedVoice = matchingVoice;
            }
            return settings;
        } catch(e) { console.error("Failed to load voice settings", e); return { pitch: 1, rate: 1, volume: 1 }; }
    }

    speak(text: string, onEnd?: () => void, onBoundary?: () => void) {
        this.synth.cancel(); 
        if(!text) return;
        
        // Refresh settings immediately before speaking to capture any changes
        const settings = this.updateSettingsFromStorage();

        const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
        if (!this.selectedVoice) this.refreshVoices();
        
        // Use updated selected voice
        if (this.selectedVoice) u.voice = this.selectedVoice;
        
        // Apply persisted settings
        u.pitch = settings.pitch; 
        u.rate = settings.rate; 
        u.volume = settings.volume;

        if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
        if (onBoundary) { u.onboundary = (event) => { if (event.name === 'word') onBoundary(); }; }
        this.synth.speak(u);
    }
    stopSpeaking() { this.synth.cancel(); }
    startListening(onUpdate: (text: string) => void, onFinal: (text: string) => void) {
        if (!this.recognition) return;
        if (this.isListening) return;
        this.onUpdateCallback = onUpdate;
        this.onFinalCallback = onFinal;
        this.currentTranscript = '';
        this.pendingCommit = false;
        this.isListening = true;
        window.dispatchEvent(new CustomEvent('voice-status', { detail: 'LISTENING' }));
        try {
            this.recognition.start();
        } catch (e) {
            console.error(e);
            this.isListening = false;
        }
    }
    stopListening(shouldCommit = false) { 
        if (shouldCommit) this.pendingCommit = true;
        if (this.recognition) this.recognition.stop(); 
        this.isListening = false;
        if(this.silenceTimer) clearTimeout(this.silenceTimer);
    }
}
const VoiceSkill = new AgentVoiceManager();

// ==========================================
// 11. THE CORE (VORTEX REACTOR VISUALIZER)
// ==========================================
const VoxelAgent = forwardRef(({ className }: { className?: string }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ isSpeaking: false, intensity: 0, currentPulse: 0 });
  
  useImperativeHandle(ref, () => ({
    speak: () => { stateRef.current.isSpeaking = true; },
    stop: () => { stateRef.current.isSpeaking = false; },
    pulse: () => { stateRef.current.currentPulse = 1.5; } 
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    // Clear mount content safely without using innerHTML (avoid XSS sinks)
    if (typeof container.replaceChildren === 'function') container.replaceChildren(); else container.textContent = '';
    const w = window.innerWidth, h = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 1000);
    camera.position.set(0, 4, 65);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0); 
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    // ASSETS
    const CONFIG = { faceSize: 16, glassRadius: 24, baseBloom: 1.2, peakBloom: 3.5, boltCount: 8, boltSegments: 15 }; 
    function createFaceTexture() {
        const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(canvas);
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,size,size);
        for(let i=0; i<2000; i++) { 
            const x = Math.random()*size; const y = Math.random()*size; const d = Math.sqrt((x-size/2)**2 + (y-size/2)**2);
            if(d < size*0.4 && Math.random() > (d/(size*0.4))) { ctx.fillStyle = `rgba(180, 255, 255, ${0.4 + Math.random()*0.6})`; ctx.fillRect(x,y,2,2); }
        }
        ctx.shadowBlur = 60; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(size*0.35, size*0.45, 15, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(size*0.65, size*0.45, 15, 0, Math.PI*2); ctx.fill();
        return new THREE.CanvasTexture(canvas);
    }
    function createBrandTexture() {
        const w = 1024; const h = 128; const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d');
        if(!ctx) return new THREE.CanvasTexture(canvas);
        ctx.clearRect(0, 0, w, h); ctx.font = 'bold 80px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0, 255, 255, 0.8)'; ctx.shadowBlur = 15; ctx.fillStyle = '#00ffff'; ctx.fillText("LEEWAY INDUSTRIES", w/2, h/2);
        return new THREE.CanvasTexture(canvas);
    }
    const faceGroup = new THREE.Group(); scene.add(faceGroup);
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.faceSize, CONFIG.faceSize), new THREE.MeshBasicMaterial({ map: createFaceTexture(), transparent: true, opacity: 2.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthTest: false }));
    faceMesh.renderOrder = 999; faceGroup.add(faceMesh);
    const mouthMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ map: createBrandTexture(), transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthTest: false }));
    mouthMesh.position.set(0, -3.2, 0.2); mouthMesh.renderOrder = 1000; faceGroup.add(mouthMesh);

    const dustGeo = new THREE.BufferGeometry(); const dustCount = 8000;
    const dustPos = new Float32Array(dustCount * 3); const dustCol = new Float32Array(dustCount * 3);
    for(let i=0; i<dustCount; i++) {
        const r = 10 + Math.random() * 35; const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1);
        dustPos[i*3] = r * Math.sin(phi) * Math.cos(theta); dustPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta); dustPos[i*3+2] = r * Math.cos(phi);
        const c = (Math.random()>0.7) ? new THREE.Color('#ffffff') : new THREE.Color('#0088ff'); dustCol[i*3] = c.r; dustCol[i*3+1] = c.g; dustCol[i*3+2] = c.b;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
    const dustSystem = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })); scene.add(dustSystem);

    const pyramidMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.25, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x88ffff, emissive: 0x00ffff, emissiveIntensity: 0.5, roughness: 0.2, flatShading: true }), 1500); scene.add(pyramidMesh);
    const dummy = new THREE.Object3D();
    for(let i=0; i<1500; i++) {
        const r = 6 + Math.random() * 20; const theta = Math.random() * Math.PI * 2; const phi = Math.random() * Math.PI;
        dummy.position.set(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi)); dummy.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); const s = Math.random() * 0.8 + 0.4; dummy.scale.set(s,s,s); dummy.updateMatrix(); pyramidMesh.setMatrixAt(i, dummy.matrix);
    }
    const bolts: THREE.Mesh[] = []; const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    for(let i=0; i<CONFIG.boltCount; i++) { const mesh = new THREE.Mesh(new THREE.BufferGeometry(), boltMat); mesh.userData = { thickness: 0.1 + Math.random()*0.3 }; mesh.visible = false; scene.add(mesh); bolts.push(mesh); }
    function updateBolts(intensity: number) {
        bolts.forEach(bolt => {
            if(Math.random() < (intensity * 0.4)) {
                bolt.visible = true;
                const p1 = new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10); const dir = new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize(); const p2 = dir.multiplyScalar(30); const points = [];
                for(let k=0; k<=CONFIG.boltSegments; k++) { const t = k/CONFIG.boltSegments; const pos = new THREE.Vector3().lerpVectors(p1, p2, t); const j = Math.sin(t*Math.PI) * 4.0; pos.add(new THREE.Vector3((Math.random()-0.5)*j, (Math.random()-0.5)*j, (Math.random()-0.5)*j)); points.push(pos); }
                if(bolt.geometry) bolt.geometry.dispose(); const curve = new THREE.CatmullRomCurve3(points); bolt.geometry = new THREE.TubeGeometry(curve, CONFIG.boltSegments, bolt.userData.thickness * (1+intensity), 4, false);
            } else { bolt.visible = false; }
        });
    }

    const reactorLight = new THREE.PointLight(0x00ffff, 0, 80); scene.add(reactorLight); scene.add(new THREE.AmbientLight(0x111122, 1.0));
    const glassMesh = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.glassRadius, 64, 64), new THREE.MeshPhysicalMaterial({ color: 0xccffff, roughness: 0, metalness: 0.1, transmission: 1, transparent: true, opacity: 0.1, thickness: 2, ior: 1.5, side: THREE.DoubleSide })); scene.add(glassMesh);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.5, 0.4, 0.85); bloomPass.threshold = 0; bloomPass.strength = CONFIG.baseBloom; bloomPass.radius = 0.5; composer.addPass(bloomPass);

    let time = 0; let reqId: number;
    const animate = () => {
        if (!mountRef.current) return; reqId = requestAnimationFrame(animate); time += 0.12; controls.update();
        stateRef.current.currentPulse *= 0.8; 
        let targetIntensity = 0.0;
        if(stateRef.current.isSpeaking) { targetIntensity = 0.2 + (stateRef.current.currentPulse * 1.5); }
        stateRef.current.intensity = THREE.MathUtils.lerp(stateRef.current.intensity, targetIntensity, 0.4);
        const speechIntensity = stateRef.current.intensity;

        const ripple = Math.sin(time * 20) * (speechIntensity * 0.25); glassMesh.scale.setScalar(1 + (speechIntensity * 0.25) + ripple); glassMesh.rotation.z += 0.04 + (speechIntensity * 0.08);
        const strobe = speechIntensity; reactorLight.intensity = 2 + (strobe * 250.0); bloomPass.strength = CONFIG.baseBloom + (strobe * 8.0); pyramidMesh.material.emissiveIntensity = 0.5 + (strobe * 6.0);
        const pulse = 1 + (speechIntensity * 0.6); dustSystem.scale.setScalar(pulse); dustSystem.rotation.y += 0.02 + (speechIntensity * 0.1);
        updateBolts(speechIntensity);
        faceGroup.lookAt(camera.position); faceGroup.scale.setScalar(1 + speechIntensity * 0.4);
        mouthMesh.scale.setScalar(1 + strobe * 0.4); 
        if (strobe > 0.5) { mouthMesh.position.x = (Math.random() - 0.5) * 0.3 * strobe; mouthMesh.position.y = -3.2 + (Math.random() - 0.5) * 0.3 * strobe; } else { mouthMesh.position.x = 0; mouthMesh.position.y = -3.2; }
        (mouthMesh.material as THREE.MeshBasicMaterial).opacity = 0.8 + (strobe * 0.5);
        if(stateRef.current.isSpeaking && strobe > 0.8) { const shake = (strobe - 0.8) * 0.6; camera.position.x += (Math.random()-0.5) * shake; camera.position.y += (Math.random()-0.5) * shake; }
        composer.render();
    };
    animate();
    const resize = () => { const newW = window.innerWidth; const newH = window.innerHeight; renderer.setSize(newW, newH); composer.setSize(newW, newH); camera.aspect = newW/newH; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(reqId); renderer.dispose(); };
  }, []);
    return <div ref={mountRef} className={`${className ?? ''} pointer-events-auto`} />;
});

// ==========================================
// 12. COMPONENT: BOOT SCREEN (Agent Lee)
// ==========================================
interface Ring { radius: number; width: number; color: string; rotation: number; locked: boolean; rotating: boolean; speed: number; }
interface Chevron { letter: string; model: string; startAngle: number; currentAngle: number; targetAngle: number; locked: boolean; traveling: boolean; loadingProgress: number; bottomOffset: number; lockingPhase: number; shakeOffset: number; glowIntensity: number; coreName?: string; }
interface Particle { angle: number; radius: number; baseRadius: number; speed: number; size: number; chaos: number; chaosSpeed: number; colorPhase: number; layer?: number; }
interface Circuit { x: number; y: number; length: number; angle: number; opacity: number; }

const BOOT_STYLES = `
  .boot-container { position: fixed; inset: 0; z-index: 9999; background: #020305; font-family: 'Courier New', monospace; display: flex; flex-direction: column; height: 100dvh; width: 100vw; overflow: hidden; color: #aaccff; }
  
  @media (min-width: 768px) {
    .boot-container { flex-direction: row; }
  }

  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #05070a; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a9eff; }
  
  /* Mobile: Vertical Stack */
  .col-center { width: 100%; height: 35%; position: relative; background: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; order: 1; flex-shrink: 0; }
  .col-right { width: 100%; height: 65%; background: #05070a; border-top: 1px solid #222; display: flex; flex-direction: column; z-index: 10; order: 2; overflow: hidden; }
  .col-left { display: none; } /* Hide diagnostics on mobile to save space */

  /* Desktop: Horizontal Layout */
  @media (min-width: 768px) {
    .col-left { width: 25%; display: flex; flex-direction: column; border-right: 1px solid #222; height: 100%; order: 1; padding: 20px; box-shadow: 10px 0 30px rgba(0,0,0,0.3); z-index: 10; }
    .col-center { width: 50%; height: 100%; order: 2; }
    .col-right { width: 25%; height: 100%; border-left: 1px solid #222; border-top: none; order: 3; }
  }

  .diag-header { color: #4a9eff; font-size: 14px; font-weight: 800; letter-spacing: 2px; border-bottom: 2px solid #4a9eff; padding-bottom: 10px; margin-bottom: 30px; text-transform: uppercase; }
  .diag-item { margin-bottom: 25px; border-left: 2px solid #333; padding-left: 15px; transition: border-color 0.3s; }
  .diag-item:hover { border-left-color: #ffd700; }
  .diag-label { font-size: 10px; color: #557799; margin-bottom: 5px; display: block; letter-spacing: 1px; }
  .diag-value { font-size: 12px; color: #fff; font-weight: bold; display: block; text-shadow: 0 0 5px rgba(74, 158, 255, 0.3); }
  .status-ok { color: #00ff88; }
  .status-warn { color: #ffd700; }
  
  .title-container { position: absolute; top: 10%; width: 100%; text-align: center; pointer-events: none; z-index: 20; }
  .main-title { color: #4a9eff; text-shadow: 0 0 30px rgba(74, 158, 255, 0.6); font-size: 24px; font-weight: 900; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 5px; }
  .sub-title { font-size: 10px; color: #8b7355; letter-spacing: 3px; opacity: 0.8; text-transform: uppercase; }
  
  .protocol-header { flex-shrink: 0; padding: 20px; border-bottom: 1px solid #333; background: #05070a; z-index: 2; }
  .protocol-header h1 { color: #fff; font-size: 14px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; line-height: 1.4; margin: 0; }
  .protocol-header h2 { color: #4a9eff; font-size: 10px; margin-top: 5px; letter-spacing: 2px; text-transform: uppercase; }
  
  .protocol-scroll-area { flex: 1; overflow-y: auto; padding: 20px; -webkit-overflow-scrolling: touch; }
  .text-block { margin-bottom: 20px; }
  .text-block h3 { color: #ffd700; font-size: 11px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; display: flex; align-items: center; }
  .text-block h3::before { content: ''; display: inline-block; width: 6px; height: 6px; background: #ffd700; margin-right: 8px; box-shadow: 0 0 8px #ffd700; }
  .text-body { font-size: 11px; line-height: 1.6; color: #8daabf; text-align: justify; }
  .warning-box { background: rgba(255, 50, 50, 0.08); border: 1px solid rgba(255, 50, 50, 0.2); padding: 15px; border-radius: 4px; }
  
  .hardware-list { margin-top: 10px; padding-left: 15px; border-left: 1px solid #4a9eff; }
  .hardware-item { display: block; margin-bottom: 5px; color: #aaccff; font-size: 10px; }
  .hardware-item span { color: #4a9eff; font-weight: bold; }
  
  .protocol-footer { flex-shrink: 0; background: #020305; padding: 20px; border-top: 1px solid #222; z-index: 2; padding-bottom: max(20px, env(safe-area-inset-bottom)); }
  .checkbox-row { display: flex; align-items: flex-start; gap: 10px; font-size: 10px; color: #778899; margin-bottom: 15px; cursor: pointer; }
  .checkbox-row input { margin-top: 2px; cursor: pointer; }
  
  .action-btn { width: 100%; padding: 12px; background: rgba(74, 158, 255, 0.05); border: 1px solid #4a9eff; color: #4a9eff; font-family: inherit; font-weight: bold; font-size: 12px; letter-spacing: 2px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
  .action-btn:hover { background: #4a9eff; color: #000; box-shadow: 0 0 15px rgba(74, 158, 255, 0.4); }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; background: transparent; shadow: none; }
  
  .leeway-watermark { margin-top: 15px; text-align: center; opacity: 0.6; }
  .leeway-watermark div:first-child { color: #fff; font-size: 10px; font-weight: bold; letter-spacing: 1px; }
  .leeway-watermark div:last-child { color: #4a9eff; font-size: 9px; margin-top: 3px; }
`;

const AgentLeeBootScreen = ({ onInitialize }: { onInitialize: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const cpuRef = useRef<HTMLSpanElement>(null);
  const gpuRef = useRef<HTMLSpanElement>(null);
  const micRef = useRef<HTMLSpanElement>(null);
  const osRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // 1. Hardware Detection
    const detectSystem = async () => {
      // CPU
      if (cpuRef.current) {
        const cores = navigator.hardwareConcurrency || 4;
        cpuRef.current.innerText = `${cores} LOGIC CORES`;
      }
      // GPU
      if (gpuRef.current) {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
          const renderer = debugInfo && gl 
            ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) 
            : 'STANDARD WEBGPU';
          let cleanRenderer = renderer.replace(/angle \(/i, '').replace(/\)/, '');
          if (cleanRenderer.length > 20) cleanRenderer = "DISCRETE GPU DETECTED";
          gpuRef.current.innerText = cleanRenderer.toUpperCase();
        } catch (e) {
          gpuRef.current.innerText = "GENERIC ACCELERATOR";
        }
      }
      // OS
      if (osRef.current) {
        let os = "UNKNOWN HOST";
        if (navigator.userAgent.indexOf("Win") !== -1) os = "WINDOWS NT KERNEL";
        if (navigator.userAgent.indexOf("Mac") !== -1) os = "DARWIN / MACOS";
        if (navigator.userAgent.indexOf("Linux") !== -1) os = "LINUX SUBSYSTEM";
        osRef.current.innerText = os;
      }
      // Mic
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasMic = devices.some(device => device.kind === 'audioinput');
          if (micRef.current) micRef.current.innerText = hasMic ? "AVAILABLE (WAITING)" : "NO INPUT FOUND";
        } catch (e) { if (micRef.current) micRef.current.innerText = "PERMISSION LOCKED"; }
      }
    };
    detectSystem();

    // Pre-load logic for systems (Core/Vision)
    console.log('[ModelLoad] Starting pre-load of QWEN and VISION models...');
    LocalModelHub.load('QWEN').then(() => {
      console.log('[ModelLoad] QWEN model loaded successfully');
    }).catch((error) => {
      console.error('[ModelLoad] QWEN model failed to load:', error);
    });
    LocalModelHub.load('VISION').then(() => {
      console.log('[ModelLoad] VISION model loaded successfully');
    }).catch((error) => {
      console.error('[ModelLoad] VISION model failed to load:', error);
    });
  }, []);

  useEffect(() => {
    // 2. Animation (Rings, Chevrons, etc.) - same as before
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = container.clientWidth;
    let H = container.clientHeight;
    let centerX = W / 2;
    let centerY = H / 2;
    let baseRadius = Math.min(W, H * 0.8) / 2.6;

    const quantumSymbols = ['⟨ψ|', '|φ⟩', '∫', '∂', '∇', '⊗', '⊕', '≡', '≈', '∞', '⟨0|', '|1⟩', 'Ĥ', 'Û', '√', '∑', '∏', '⊤', '⊥', '⊙', '101', '010', '110', '001', '111', '000', '⊛', '⊚', '◉', '◎'];
    
    const rings: Record<string, Ring> = {
      outer: { radius: baseRadius, width: 22, color: '#2a2a2a', rotation: 0, locked: false, rotating: false, speed: 0 },
      middle: { radius: baseRadius * 0.85, width: 18, color: '#3a3a3a', rotation: 0, locked: false, rotating: false, speed: 0 },
      inner: { radius: baseRadius * 0.70, width: 16, color: '#4a4a4a', rotation: 0, locked: false, rotating: false, speed: 0 }
    };
    
    const chevrons: Chevron[] = [
      { letter: 'L', model: 'QWEN', startAngle: 0, currentAngle: 0, targetAngle: -Math.PI / 2, locked: false, traveling: false, loadingProgress: 0, bottomOffset: 0, lockingPhase: 0, shakeOffset: 0, glowIntensity: 0 },
      { letter: 'E', model: 'PHI-3', startAngle: 0, currentAngle: 0, targetAngle: Math.PI / 6, locked: false, traveling: false, loadingProgress: 0, bottomOffset: 0, lockingPhase: 0, shakeOffset: 0, glowIntensity: 0 },
      { letter: 'E', model: 'VIT', startAngle: 0, currentAngle: 0, targetAngle: 5 * Math.PI / 6, locked: false, traveling: false, loadingProgress: 0, bottomOffset: 0, lockingPhase: 0, shakeOffset: 0, glowIntensity: 0 }
    ];
    
    const coreParticles: Particle[] = [];
    for (let i = 0; i < 2000; i++) {
      coreParticles.push({
        angle: Math.random() * Math.PI * 2, radius: Math.random() * 150, baseRadius: Math.random() * 150, speed: (Math.random() - 0.5) * 0.04, size: Math.random() * 2 + 0.5, chaos: Math.random() * 2 - 1, chaosSpeed: Math.random() * 0.15 + 0.05, colorPhase: Math.random() * Math.PI * 2
      });
    }
    
    const circuits: Circuit[] = [];
    for (let i = 0; i < 30; i++) {
      circuits.push({ x: Math.random() * W, y: Math.random() * H, length: Math.random() * 200 + 100, angle: Math.random() * Math.PI * 2, opacity: Math.random() * 0.15 + 0.05 });
    }

    const handleResize = () => {
      if (!container || !canvas) return;
      W = canvas.width = container.clientWidth;
      H = canvas.height = container.clientHeight;
      centerX = W / 2;
      centerY = H / 2;
      baseRadius = Math.min(W, H * 0.8) / 2.6;
      rings.outer.radius = baseRadius;
      rings.middle.radius = baseRadius * 0.85;
      rings.inner.radius = baseRadius * 0.70;
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    let animationState = 'START';
    let currentChevronIdx = 0;
    let waitTimer = 0;
    let apertureRadius = 0;
    let targetApertureRadius = 0;
    let globalPulse = 0;
    let chaosLevel = 0;
    let letterOpacities = [0, 0, 0];
    let animationFrameId: number;

    const setRingRotation = (active: boolean, clockwise: boolean) => {
      const dir = clockwise ? 1 : -1;
      rings.outer.rotating = active; rings.outer.speed = 0.015 * dir;
      rings.middle.rotating = active; rings.middle.speed = -0.02 * dir;
      rings.inner.rotating = active; rings.inner.speed = 0.01 * dir;
    };

    const animate = () => {
      if (animationState === 'START') {
        waitTimer++;
        if (waitTimer > 50) {
          animationState = 'MOVING';
          const c = chevrons[currentChevronIdx];
          c.traveling = true; c.startAngle = c.targetAngle - (Math.PI * 1.5); c.currentAngle = c.startAngle; c.bottomOffset = 30; setRingRotation(true, true);
        }
      } else if (animationState === 'MOVING') {
        const c = chevrons[currentChevronIdx];
        c.loadingProgress += 0.8;
        const progress = Math.min(1, c.loadingProgress / 100);
        c.currentAngle = c.startAngle + (c.targetAngle - c.startAngle) * progress;
        if (progress >= 1) { c.currentAngle = c.targetAngle; c.traveling = false; animationState = 'LOCKING'; setRingRotation(false, true); }
      } else if (animationState === 'LOCKING') {
        const c = chevrons[currentChevronIdx];
        c.lockingPhase += 0.05; c.bottomOffset = 30 * (1 - c.lockingPhase); c.shakeOffset = (Math.random() - 0.5) * 0.05 * (1 - c.lockingPhase); c.glowIntensity = c.lockingPhase;
        if (c.lockingPhase >= 1) { c.locked = true; c.shakeOffset = 0; c.bottomOffset = 0; c.glowIntensity = 1;
          const maxR = rings.inner.radius; const stages = [maxR * 0.40, maxR * 0.70, maxR * 1.05];
          targetApertureRadius = stages[currentChevronIdx]; animationState = 'WAITING'; waitTimer = 0;
        }
      } else if (animationState === 'WAITING') {
        waitTimer++;
        if (waitTimer > 60) {
          currentChevronIdx++;
          if (currentChevronIdx < chevrons.length) {
            animationState = 'MOVING';
            const c = chevrons[currentChevronIdx];
            c.traveling = true; c.startAngle = c.targetAngle - (Math.PI * 1.5); c.currentAngle = c.startAngle; c.bottomOffset = 30; setRingRotation(true, currentChevronIdx % 2 === 0);
          } else { animationState = 'FULLY_OPEN'; }
        }
      } else if (animationState === 'FULLY_OPEN') { chaosLevel += (1 - chaosLevel) * 0.05; }

      ctx!.clearRect(0, 0, W, H); ctx!.fillStyle = '#020305'; ctx!.fillRect(0, 0, W, H);
      ctx!.strokeStyle = 'rgba(50, 70, 100, 0.04)'; ctx!.lineWidth = 1; const gridSize = 40;
      for(let x=0; x<W; x+=gridSize) { ctx!.beginPath(); ctx!.moveTo(x,0); ctx!.lineTo(x,H); ctx!.stroke(); }
      for(let y=0; y<H; y+=gridSize) { ctx!.beginPath(); ctx!.moveTo(0,y); ctx!.lineTo(W,y); ctx!.stroke(); }

      circuits.forEach(c => { ctx!.strokeStyle = `rgba(100, 130, 180, ${c.opacity})`; ctx!.lineWidth = 0.5; ctx!.beginPath(); ctx!.moveTo(c.x, c.y); ctx!.lineTo(c.x + Math.cos(c.angle) * c.length, c.y + Math.sin(c.angle) * c.length); ctx!.stroke(); });

      [rings.outer, rings.middle, rings.inner].forEach(ring => {
        if(ring.rotating) ring.rotation += ring.speed;
        ctx!.save(); ctx!.translate(centerX, centerY); ctx!.rotate(ring.rotation);
        ctx!.strokeStyle = ring.color; ctx!.lineWidth = ring.width; ctx!.shadowBlur = ring.locked ? 15 : 0; ctx!.shadowColor = ring.locked ? 'rgba(255, 215, 0, 0.3)' : 'transparent'; ctx!.beginPath(); ctx!.arc(0, 0, ring.radius, 0, Math.PI * 2); ctx!.stroke(); ctx!.shadowBlur = 0;
        ctx!.strokeStyle = `rgba(100, 150, 200, ${ring.rotating ? 0.8 : (ring.locked ? 0.6 : 0.3)})`; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.arc(0, 0, ring.radius - ring.width / 2 + 4, 0, Math.PI * 2); ctx!.stroke();
        if (ring === rings.outer) {
          ctx!.font = '10px Courier New'; ctx!.fillStyle = 'rgba(255, 215, 0, 0.6)'; ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
          for (let i = 0; i < 36; i++) { const angle = (i / 36) * Math.PI * 2; const symbol = quantumSymbols[i % quantumSymbols.length]; ctx!.save(); ctx!.rotate(angle); ctx!.translate(0, -(ring.radius - ring.width / 2)); ctx!.rotate(Math.PI / 2); ctx!.fillText(symbol, 0, 0); ctx!.restore(); }
        }
        if (ring.locked || ring.rotating) {
          const pulses = ring === rings.inner ? 6 : 12;
          for (let i = 0; i < pulses; i++) { const angle = (i / pulses) * Math.PI * 2 + (ring.rotation * (ring === rings.inner ? -2 : 3)); const x1 = Math.cos(angle) * (ring.radius); const y1 = Math.sin(angle) * (ring.radius); ctx!.fillStyle = `rgba(0, 180, 255, ${ring.rotating ? 0.9 : 0.5})`; ctx!.beginPath(); ctx!.arc(x1, y1, ring.rotating ? 2 : 3, 0, Math.PI * 2); ctx!.fill(); }
        }
        ctx!.restore();
      });

      chevrons.forEach(c => {
        const angle = c.currentAngle + c.shakeOffset; const x = centerX + Math.cos(angle) * rings.outer.radius; const y = centerY + Math.sin(angle) * rings.outer.radius;
        ctx!.save(); ctx!.translate(x, y); ctx!.rotate(angle);
        ctx!.save(); const topGradient = ctx!.createLinearGradient(0, -20, 0, 0); topGradient.addColorStop(0, '#444'); topGradient.addColorStop(1, '#222'); ctx!.fillStyle = topGradient; ctx!.strokeStyle = '#666'; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.rect(-22.5, -20, 45, 20); ctx!.fill(); ctx!.stroke(); ctx!.restore();
        ctx!.save(); ctx!.translate(0, c.bottomOffset); const bottomGradient = ctx!.createLinearGradient(0, 0, 0, 25); bottomGradient.addColorStop(0, '#a68b5b'); bottomGradient.addColorStop(1, '#5a4a37'); ctx!.fillStyle = bottomGradient; ctx!.strokeStyle = c.locked ? '#ffd700' : '#6b5a47'; ctx!.lineWidth = c.locked ? 2 : 1; ctx!.beginPath(); ctx!.rect(-18.5, 0, 37, 25); ctx!.fill(); ctx!.stroke();
        if (c.glowIntensity > 0 || c.locked) { const g = c.glowIntensity; ctx!.shadowBlur = 15 * g; ctx!.shadowColor = '#ffaa00'; ctx!.fillStyle = `rgba(255, 200, 50, ${g})`; ctx!.beginPath(); ctx!.arc(0, 12.5, 6, 0, Math.PI * 2); ctx!.fill(); ctx!.shadowBlur = 0; }
        ctx!.font = 'bold 9px Courier New'; ctx!.fillStyle = '#111'; ctx!.textAlign = 'center'; ctx!.fillText(c.model, 0, 19); ctx!.restore(); ctx!.restore();
        if (c.traveling && !c.locked) { const labelX = centerX + Math.cos(angle) * (rings.outer.radius + 50); const labelY = centerY + Math.sin(angle) * (rings.outer.radius + 50); ctx!.font = 'bold 16px Courier New'; ctx!.fillStyle = '#ff9900'; ctx!.strokeStyle = 'black'; ctx!.lineWidth = 2; ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'; const pct = Math.floor(c.loadingProgress); ctx!.strokeText(`${pct}%`, labelX, labelY); ctx!.fillText(`${pct}%`, labelX, labelY); }
      });

      globalPulse += 0.05; apertureRadius += (targetApertureRadius - apertureRadius) * 0.1;
      ctx!.save(); ctx!.beginPath(); ctx!.arc(centerX, centerY, Math.max(0, apertureRadius), 0, Math.PI * 2); ctx!.clip(); 
      coreParticles.forEach(p => { p.colorPhase += 0.02; p.chaos += (Math.random() - 0.5) * p.chaosSpeed * chaosLevel; p.chaos *= 0.96; p.angle += p.speed + p.chaos * 0.2; const radiusWave = Math.sin(p.angle * 2 + globalPulse) * 10 * chaosLevel; p.radius = p.baseRadius + radiusWave; if (p.radius > rings.inner.radius - 20) p.radius = rings.inner.radius - 20; const px = centerX + Math.cos(p.angle) * p.radius; const py = centerY + Math.sin(p.angle) * p.radius; const hue = 200 + Math.sin(p.colorPhase) * 30; const alpha = 0.7 + Math.sin(p.colorPhase) * 0.3; ctx!.fillStyle = `hsla(${hue}, 85%, 65%, ${alpha})`; ctx!.beginPath(); ctx!.arc(px, py, p.size, 0, Math.PI * 2); ctx!.fill(); });
      const fontSize = baseRadius * 0.5; const letterSpacing = baseRadius * 0.35; ctx!.font = `900 ${fontSize}px Courier New`; ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'; ctx!.shadowBlur = 20; ctx!.shadowColor = '#4a9eff';
      if (chevrons[0].locked) letterOpacities[0] = Math.min(1, letterOpacities[0] + 0.05); ctx!.fillStyle = `rgba(255, 255, 255, ${letterOpacities[0]})`; ctx!.fillText('L', centerX - letterSpacing, centerY);
      if (chevrons[1].locked) letterOpacities[1] = Math.min(1, letterOpacities[1] + 0.05); ctx!.fillStyle = `rgba(255, 255, 255, ${letterOpacities[1]})`; ctx!.fillText('E', centerX, centerY);
      if (chevrons[2].locked) letterOpacities[2] = Math.min(1, letterOpacities[2] + 0.05); ctx!.fillStyle = `rgba(255, 255, 255, ${letterOpacities[2]})`; ctx!.fillText('E', centerX + letterSpacing, centerY);
      ctx!.restore();

      if (apertureRadius > 1) { ctx!.strokeStyle = '#4a9eff'; ctx!.lineWidth = 3; ctx!.shadowBlur = 20; ctx!.shadowColor = '#4a9eff'; ctx!.beginPath(); ctx!.arc(centerX, centerY, apertureRadius, 0, Math.PI * 2); ctx!.stroke(); ctx!.shadowBlur = 0; }
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => { resizeObserver.disconnect(); cancelAnimationFrame(animationFrameId); };
  }, []);

  return (
    <div className="boot-container">
      <style>{BOOT_STYLES}</style>

      {/* 1. LEFT COLUMN: SYSTEM DIAGNOSTICS */}
      <div className="col-left">
        <div className="diag-header">SYSTEM DIAGNOSTICS</div>
        <div className="diag-item"><span className="diag-label">HOST STATUS</span><span className="diag-value status-ok">ONLINE / LISTENING</span></div>
        <div className="diag-item"><span className="diag-label">NEURAL ENGINE</span><span className="diag-value">WEBGPU Q4 QUANTIZED</span></div>
        <div className="diag-item"><span className="diag-label">LOGIC PROCESSOR</span><span className="diag-value" ref={cpuRef}>DETECTING...</span></div>
        <div className="diag-item"><span className="diag-label">GRAPHICS ACCELERATOR</span><span className="diag-value" ref={gpuRef}>DETECTING...</span></div>
        <div className="diag-item"><span className="diag-label">AUDIO PERIPHERAL</span><span className="diag-value" ref={micRef}>CHECKING PERMISSIONS...</span></div>
        <div className="diag-item"><span className="diag-label">RUNTIME ENVIRONMENT</span><span className="diag-value" ref={osRef}>UNKNOWN</span></div>
        <div className="diag-item mt-auto"><span className="diag-label">SECURITY PROTOCOL</span><span className="diag-value status-warn">ZERO-EGRESS ACTIVE</span></div>
      </div>

      {/* 2. CENTER COLUMN: STARGATE */}
      <div className="col-center" ref={containerRef}>
        <div className="title-container">
          <div className="main-title">Agent Lee</div>
          <div className="sub-title">Sovereign Neural Monolith</div>
        </div>
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* 3. RIGHT COLUMN: PROTOCOL */}
      <div className="col-right">
        <div className="protocol-header"><h1>LEEWAY STANDARDS PROTOCOL</h1><h2>v30.0 | INITIALIZATION</h2></div>
        <div className="protocol-scroll-area custom-scrollbar">
          <div className="text-block"><h3>THE MANIFESTO</h3><div className="text-body">"The cloud is someone else's computer. Agent Lee is yours."<br/><br/>Agent Lee is a <strong>Sovereign Neural Monolith</strong>. He lives entirely within your browser's memory heap. No backends. No API keys. No subscriptions.</div></div>
          <div className="text-block"><h3>SENSORY ACCESS</h3><div className="text-body">To function as a fully realized digital entity, Agent Lee requires direct access to your local peripherals. You must grant permission for the following:<div className="hardware-list"><div className="hardware-item"><span>VISUAL CORTEX:</span> Camera Access (Vision)</div><div className="hardware-item"><span>AUDITORY INPUT:</span> Microphone (Voice Command)</div><div className="hardware-item"><span>VOCAL SYNTHESIS:</span> Audio Output (Speakers)</div></div></div></div>
          <div className="text-block"><h3>THE ARCHITECTURE</h3><div className="text-body"><strong>1. WEB-GPU CORE:</strong> Local inference using Q4 quantization.<br/><strong>2. THE VAULT:</strong> Encrypted IndexedDB file system. 8 Drives × 8 Slots.</div></div>
          <div className="text-block"><h3>USER RESPONSIBILITY</h3><div className="text-body warning-box"><strong>DATA VOLATILITY WARNING</strong><br/><br/>Your conversation history lives in browser storage. Browsers may clear this to save space. <strong>YOU MUST REGULARLY DOWNLOAD YOUR FILES.</strong> Failure to export will result in total memory loss.</div></div>
        </div>
        <div className="protocol-footer">
          <label className="checkbox-row"><input type="checkbox" checked={hasConsented} onChange={(e) => setHasConsented(e.target.checked)} /><span>I grant sensory permissions & acknowledge the data backup responsibility.</span></label>
          <button className="action-btn" disabled={!hasConsented} onClick={() => hasConsented && onInitialize()}>INITIALIZE SYSTEM</button>
          <div className="leeway-watermark"><div>By Leeway Innovation</div><div>A Leeway Industries Product</div></div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 13. MAIN APP CONTROLLER
// ==========================================
// COMPONENT: CAMERA MODAL
const CameraModal = ({ onClose, onCapture }: { onClose: () => void, onCapture: (img: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [facingMode, setFacingMode] = useState<'user'|'environment'>('user');

    useEffect(() => {
        let stream: MediaStream;
        try {
            PolicyRegistry.require('WEB_CAMERA'); // POLICY CHECK
        } catch (e) {
            console.warn('[CameraModal] Camera blocked by policy.');
            onClose();
            return;
        }

        const start = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                if(videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.muted = true; // Crucial for autoplay on mobile
                }
            } catch(e) { console.error("Cam Error", e); onClose(); }
        };
        start();
        return () => { if(stream) stream.getTracks().forEach(t=>t.stop()); };
    }, [facingMode]);

    const snap = () => {
        if(!videoRef.current || !canvasRef.current) return;
        const cvs = canvasRef.current;
        cvs.width = videoRef.current.videoWidth;
        cvs.height = videoRef.current.videoHeight;
        cvs.getContext('2d')?.drawImage(videoRef.current, 0,0);
        onCapture(cvs.toDataURL('image/jpeg'));
        onClose();
    };

    return (
        <div className="fixed bottom-5 left-5 z-[200] w-80 h-56 bg-black border-2 border-cyan-500 rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.2)] flex flex-col overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center">
                <span className="text-[10px] font-bold text-cyan-400 px-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> LIVE FEED</span>
                <button onClick={onClose} title="Close" aria-label="Close camera" className="p-1 rounded-full bg-black/50 text-gray-400 hover:text-white hover:bg-red-900/80 transition-colors"><X size={14}/></button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="flex-1 object-cover w-full h-full" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-4">
                <button onClick={()=>setFacingMode(f=>f==='user'?'environment':'user')} title="Flip camera" aria-label="Flip camera" className="p-2 rounded-full bg-gray-900/80 border border-gray-700 text-white hover:bg-gray-800 backdrop-blur"><RefreshCw size={14}/></button>
                <button onClick={snap} title="Capture photo" aria-label="Capture photo" className="p-3 rounded-full bg-white ring-2 ring-cyan-500/50 hover:scale-110 transition-transform shadow-lg"><Camera size={18} className="text-cyan-600"/></button>
            </div>
        </div>
    );
};

const AgentLeeInterface = () => {
    const [consented, setConsented] = useState(false);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    
    // Debug sidebar state changes
    useEffect(() => {
        console.log('[Sidebar] State changed - leftOpen:', leftOpen, 'rightOpen:', rightOpen);
    }, [leftOpen, rightOpen]);
    // Removed leftView state as navigation is flattened
    const [messages, setMessages] = useState<{role:string, text:string, type?:string}[]>([]);
    const [input, setInput] = useState('');
    const [agentStatus, setAgentStatus] = useState('IDLE');
    const [showCamera, setShowCamera] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [showEmailCenter, setShowEmailCenter] = useState(false);
    const [webSearchActive, setWebSearchActive] = useState(false);
    
    // NEW: Phone State
    const [showPhone, setShowPhone] = useState(false);
    
    // NEW: Memory Lake State (Full Modal)
    const [showMemoryLake, setShowMemoryLake] = useState(false);
    
    // File Explorer State
    const [selectedDrive, setSelectedDrive] = useState<string>('L');
    const [selectedSlot, setSelectedSlot] = useState<number>(1);
    const [currentDirId, setCurrentDirId] = useState<string | null>(null);
    const [currentFiles, setCurrentFiles] = useState<any[]>([]);
    const [currentDirs, setCurrentDirs] = useState<any[]>([]);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);

    const voxelRef = useRef<any>(null);
    const msgsEndRef = useRef<HTMLDivElement>(null);
    
    // Hook into Style Engine
    const { styleText } = useStyleEngine();

    useEffect(() => {
        PolicyRegistry.initFromStorage();
        const onVoiceStatus = (e: any) => setAgentStatus(e.detail);
        window.addEventListener('voice-status', onVoiceStatus);
        
        // Initial Load
        loadSlotContent('L', 1, null);

        // Mobile Responsive Init: Close panels on small screens
        if (window.innerWidth < 768) {
            setLeftOpen(false);
            setRightOpen(false);
        }

        return () => window.removeEventListener('voice-status', onVoiceStatus);
    }, []);

    // Expose AgentControl handlers for other components (CommunicationsOutlet etc.)
    useEffect(() => {
        AGENT_CONTROL.register('App', {
            getCurrentDriveSlot: async () => {
                return { selectedDrive, selectedSlot, currentDirId, activeFileId };
            },
            saveConversationFromComms: async ({ title, messages, existingId }: any) => {
                try {
                    const res = await DriveSystem.saveConversation(selectedDrive, selectedSlot, title, messages, currentDirId, existingId);
                    // Refresh explorer view (best-effort, non-blocking)
                    loadSlotContent(selectedDrive, selectedSlot, currentDirId).catch(() => {});
                    return res;
                } catch (e) {
                    console.warn('[App] saveConversationFromComms failed', e);
                    throw e;
                }
            }
        });

        return () => {
            AGENT_CONTROL.unregister('App');
        };
    }, [selectedDrive, selectedSlot, currentDirId, activeFileId]);

    // BOOT SEQUENCE HANDLER
    const handleBootInitialize = () => {
        // Enforce Zero-Egress Profile on Boot
        PolicyRegistry.setProfile({
          id: 'LEEWAY_ZERO_EGRESS',
          label: 'Leeway Zero-Egress',
          zeroEgress: true,
          overrides: {
            WEB_CAMERA: true,
            MICROPHONE: true,
            FS_EXPORT: true,
            FS_IMPORT: true,
            // REMOTE APIs blocked by default
          },
        });
        setConsented(true);
    };

    // AUTO-SAVE SYSTEM: Monitors messages state
    useEffect(() => {
        const autoSave = async () => {
            if (messages.length > 0 && messages[0].text) {
                // LOGGING PROBE 2: Before Save
                const title = messages[0].text.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30).trim() || "New Session";
                console.log('[AutoSave] activeFileId:', activeFileId, 'messages.length:', messages.length, 'title:', title, 'drive:', selectedDrive, 'slot:', selectedSlot, 'dir:', currentDirId);
                // If we don't have an active file ID yet, create one from the first message
                if (!activeFileId) {
                    const now = new Date();
                    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const firstMessage = messages[0]?.text || 'New Chat';
                    const title = `${timestamp}_${firstMessage.slice(0, 30).replace(/[^a-zA-Z0-9\s]/g, '_')}`;
                    const result = await DriveSystem.saveConversation(selectedDrive, selectedSlot, title, messages, currentDirId);
                    // LOGGING PROBE 3: After Save
                    console.log('[AutoSave] save result:', result);
                    if (result.success) {
                        setActiveFileId(result.id);
                        const refreshed = await loadSlotContent(selectedDrive, selectedSlot, currentDirId); // Refresh explorer immediately
                        // LOGGING PROBE 3b: After List Refresh - log returned drive content (state updates are async)
                        console.log('[AutoSave] after list refresh (drive):', { filesCount: (refreshed.files || []).length, filesSample: (refreshed.files || []).slice(0,3) });
                    }
                } else {
                    await DriveSystem.saveConversation(selectedDrive, selectedSlot, title, messages, currentDirId, activeFileId);
                    // LOGGING PROBE 3: After Save (update)
                    console.log('[AutoSave] updated existing conversation');
                    const refreshed = await loadSlotContent(selectedDrive, selectedSlot, currentDirId);
                    console.log('[AutoSave] after list refresh (drive):', { filesCount: (refreshed.files || []).length, filesSample: (refreshed.files || []).slice(0,3) });
                }
            }
        };
        autoSave();
    }, [messages, activeFileId, selectedDrive, selectedSlot, currentDirId]);

    useEffect(() => {
        return AgentRuntime.subscribe((msg) => {
            if(msg.startsWith('[ACT]')) setAgentStatus('ACTING');
            else if(msg.startsWith('[PLAN]')) setAgentStatus('THINKING');
            else if(msg.startsWith('[COMPLETE]')) {
                setAgentStatus('IDLE');
                setMessages(m => [...m, { role: 'agent', text: msg.replace('[COMPLETE] ', '') }]);
            }
        });
    }, []);

    useEffect(() => { msgsEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

    const interruptAgent = () => {
        if (['SPEAKING', 'THINKING', 'ACTING', 'ANALYZING'].includes(agentStatus)) {
            AgentRuntime.abort();
            setAgentStatus('INTERRUPTED');
        }
    };

    const handleSend = async (overrideText?: string) => {
        const textToSend = overrideText || input;
        if(!textToSend.trim()) return;
        
        if(AgentRuntime.isRunning || agentStatus === 'SPEAKING') {
            AgentRuntime.abort();
        }

        setInput('');
        setMessages(p => [...p, { role: 'user', text: textToSend }]);

        await AgentPersona.evolve(textToSend);

        const driveContext = `
        CURRENT_DRIVE: ${selectedDrive}
        CURRENT_SLOT: ${selectedSlot}
        CURRENT_DIR: ${currentDirId ? currentDirId : 'ROOT'}
        VISIBLE_FILES: ${currentFiles.length > 0 ? currentFiles.map(f => f.title).join(', ') : 'EMPTY'}
        VISIBLE_DIRS: ${currentDirs.length > 0 ? currentDirs.map(d => d.name).join(', ') : 'NONE'}
        WEB_SEARCH: ${webSearchActive ? 'ENABLED' : 'DISABLED'}
        `;

        if(textToSend.toLowerCase().match(/^(click|open|type|go to|scroll|select)/i)) {
            await AgentRuntime.runTask(textToSend, driveContext);
        } else {
            setAgentStatus('THINKING');
            // Crucial Fix: DO NOT trigger voxelRef.current.speak() here.
            // Thinking state should remain calm (idle animation).
            
            try {
                // 1. Get raw response from LLM
                const rawResponse = await LocalModelHub.chat(messages.concat({role:'user', text: textToSend}), driveContext);
                
                // 2. Pass through Style Core for Humanization
                const styledResponse = await styleText(rawResponse);

                setMessages(p => [...p, { role: 'agent', text: styledResponse }]);
                
                // 3. Now trigger speaking animation
                setAgentStatus('SPEAKING');
                voxelRef.current?.speak(); // Start high energy animation
                VoiceSkill.speak(
                    styledResponse, 
                    () => { 
                        voxelRef.current?.stop(); 
                        setAgentStatus('IDLE');
                    },
                    () => voxelRef.current?.pulse() 
                );
            } catch(e) {
                setMessages(p => [...p, { role: 'agent', text: "I encountered a neural error. The local model may not be loaded." }]);
                voxelRef.current?.stop();
            } finally {
                if(agentStatus !== 'SPEAKING') setAgentStatus('IDLE');
            }
        }
    };

    const handleMicClick = () => {
        if (['SPEAKING', 'THINKING', 'ACTING', 'ANALYZING'].includes(agentStatus)) {
            interruptAgent();
            return;
        }

        if(VoiceSkill.isListening) {
            VoiceSkill.stopListening(true); 
            setAgentStatus('IDLE');
        } else {
            setAgentStatus('LISTENING');
            setInput(''); 
            VoiceSkill.startListening(
                (text) => setInput(text), 
                (finalText) => {
                    if (finalText && finalText !== 'COMMIT') {
                        handleSend(finalText);
                    } else if (finalText === 'COMMIT') {
                        handleSend(input);
                    } else {
                         if(input) handleSend(input);
                    }
                }
            );
        }
    };

    const loadSlotContent = async (drive: string, slot: number, dirId: string | null) => {
        console.log('[loadSlotContent] Starting load:', { drive, slot, dirId });
        setSelectedDrive(drive);
        setSelectedSlot(slot);
        setCurrentDirId(dirId);
        const content = await DriveSystem.listContent(drive, slot, dirId);
        console.log('[Drive] listContent result', { drive, slot, dirId, count: (content.files || []).length, files: content.files });
        // Sort files newest-first for UI consistency
        try {
            const files = Array.isArray(content.files) ? content.files.slice().sort((a,b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)) : [];
            console.log('[loadSlotContent] Setting current files:', files.length, files);
            setCurrentFiles(files);
            setCurrentDirs(Array.isArray(content.directories) ? content.directories : []);
        } catch (e) {
            console.warn('[Drive] error processing listContent', e);
            setCurrentFiles(content.files || []);
            setCurrentDirs(content.directories || []);
        }
        return content;
    };

    const handleCreateDir = async () => {
        const name = prompt("Directory Name:");
        if (name) {
            const res = await DriveSystem.createDirectory(selectedDrive, selectedSlot, name);
            if (res.success) {
                loadSlotContent(selectedDrive, selectedSlot, currentDirId);
            } else {
                alert(res.message);
            }
        }
    };

    const handleMoveFile = async (fileId: string, targetDirId: string | null) => {
      const success = await DriveSystem.moveFile(selectedDrive, selectedSlot, fileId, targetDirId);
      if (success) {
          loadSlotContent(selectedDrive, selectedSlot, currentDirId);
      } else {
          alert("Move failed. Directory may be full.");
      }
    }

    const saveConversation = async () => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const firstMessage = messages[0]?.text || 'New Chat';
        const title = `${timestamp}_${firstMessage.slice(0, 30).replace(/[^a-zA-Z0-9\s]/g, '_')}`;
        const res: any = await DriveSystem.saveConversation(selectedDrive, selectedSlot, title, messages, currentDirId);
        if (res && res.success) {
            await loadSlotContent(selectedDrive, selectedSlot, currentDirId);
            return true;
        }
        return false;
    };

    const handleNewSession = async () => {
        // LOGGING PROBE 1: New Session
        console.log('[NewSession] activeFileId:', activeFileId, 'messages.length:', messages.length, 'drive:', selectedDrive, 'slot:', selectedSlot, 'dir:', currentDirId);
        // Clear active ID so next message creates a NEW file
        setActiveFileId(null);
        setMessages([]);
        setAgentStatus('IDLE');
        // Immediately refresh left panel so it shows empty state
        loadSlotContent(selectedDrive, selectedSlot, currentDirId);
    };

    const handleLoadChat = (file: any) => {
        if(file && file.content) {
            setMessages(file.content);
            setActiveFileId(file.id); // Set active ID so we continue saving to THIS file
            // Refresh left panel to ensure selection is always in sync
            loadSlotContent(selectedDrive, selectedSlot, currentDirId);
        }
    };

    // Rename a conversation
    const handleRename = async (file: any) => {
        const newTitle = prompt('Rename conversation', file.title || '');
        if (!newTitle || newTitle.trim() === '') return;
        const ok = await DriveSystem.renameFile(selectedDrive, selectedSlot, file.id, newTitle.trim());
        if (ok) await loadSlotContent(selectedDrive, selectedSlot, currentDirId);
    };

    // Soft-delete (move to trash)
    const handleDelete = async (file: any) => {
        console.log('[Delete] Starting delete for file:', file);
        if (!confirm(`Move "${file.title || 'untitled'}" to Trash?`)) return;
        
        // Add to global trash service
        console.log('[Delete] Adding to global trash service');
        try {
            globalTrashService.addFileFromMemoryLake(file, `/Drive ${selectedDrive}/Slot ${selectedSlot}`);

            console.log('[Delete] Calling DriveSystem.deleteFile');
            const ok = await DriveSystem.deleteFile(selectedDrive, selectedSlot, file.id);
            console.log('[Delete] DriveSystem.deleteFile result:', ok);

            if (ok) {
                console.log('[Delete] Removing file from UI state');
                setCurrentFiles(prev => prev.filter((f: any) => f.id !== file.id));
                if (activeFileId === file.id) setActiveFileId(null);
                // Try a reload; if it fails, UI already removed the file optimistically
                try {
                    await loadSlotContent(selectedDrive, selectedSlot, currentDirId);
                } catch (e) {
                    console.warn('[Delete] loadSlotContent failed after delete', e);
                }
            } else {
                console.error('[Delete] DriveSystem.deleteFile returned false');
                alert('Failed to move conversation to Trash. See console for details.');
            }
        } catch (e) {
            console.error('[Delete] Exception during delete flow', e);
            alert('An error occurred while deleting the file. Check console for details.');
        }
    };

    // Smart Trash System state
    const [showTrashSystem, setShowTrashSystem] = useState(false);

    return (
        <div className="h-[100dvh] w-screen bg-[#050505] text-gray-200 font-sans overflow-hidden relative">
            
            {showCamera && <CameraModal onClose={()=>setShowCamera(false)} onCapture={async (img) => {
                setMessages(p => [...p, { role: 'user', text: 'Analyze this image.', type: 'image' }]);
                setAgentStatus('ANALYZING');
                // Explicitly tell the user the agent is looking
                setMessages(p => [...p, { role: 'agent', text: "*Processing visual input...*" }]);
                const desc = await LocalModelHub.runVision(img);
                setMessages(p => [...p, { role: 'agent', text: `I see: ${desc}` }]);
                setAgentStatus('IDLE');
            }} />}
            
            {/* SETTINGS MODAL INTEGRATION */}
            <SettingsModal isOpen={showSettings} onClose={()=>setShowSettings(false)} />
            
            {/* EMAIL CENTER INTEGRATION */}
            <EmailCenter isOpen={showEmailCenter} onClose={()=>setShowEmailCenter(false)} />

            {/* COMMUNICATIONS OUTLET (PHONE) */}
            <CommunicationsOutlet isOpen={showPhone} onClose={() => setShowPhone(false)} />

            {/* MEMORY LAKE MODAL */}
            <MemoryLakeModal isOpen={showMemoryLake} onClose={() => setShowMemoryLake(false)} />

            {/* DOCUMENTATION PANEL */}
            <AgentLeeDocs isOpen={showDocs} setIsOpen={setShowDocs} />

            {/* GLOBAL STOP BUTTON (Floating) */}
            {['SPEAKING', 'THINKING', 'ACTING', 'ANALYZING'].includes(agentStatus) && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-10 fade-in duration-300">
                    <button 
                        onClick={interruptAgent}
                        className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full text-sm font-bold shadow-[0_0_30px_rgba(220,38,38,0.8)] animate-pulse flex items-center gap-3 border-2 border-red-400 transition-transform active:scale-95 uppercase tracking-widest backdrop-blur-md"
                    >
                        <PauseCircle size={18} fill="currentColor" /> SILENCE AGENT
                    </button>
                </div>
            )}

            {/* LAYER 0: VISUALIZER */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-1000 opacity-100`}>
                <VoxelAgent ref={voxelRef} className="w-full h-full" />
            </div>

            {/* LAYER 1: UI SHELL */}
            <div className={`absolute inset-0 z-10 flex pointer-events-none transition-opacity duration-1000 ${consented?'opacity-100':'opacity-0'}`}>
                
                {/* 1. LEFT PANEL */}
                <div className={`fixed inset-y-0 left-0 z-50 bg-[#0a0a0a] border-r border-gray-800 transition-all duration-300 md:relative flex flex-col overflow-hidden shrink-0 pointer-events-auto shadow-2xl ${leftOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full'} md:translate-x-0`}>
                        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                        <div className="font-bold text-cyan-500 tracking-wider">AGENT LEE</div>
                        <button onClick={()=>{console.log('[Sidebar] Closing left panel'); setLeftOpen(false);}} title="Close sidebar" aria-label="Close sidebar" className="text-gray-500 hover:text-white"><PanelLeftClose size={18}/></button>
                    </div>
                    
                    {/* CHAT LIST HEADER (Simplified) */}
                    <div className="p-3 bg-gray-900/50 border-b border-gray-800">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={12}/> ACTIVE CHATS
                        </div>
                    </div>

                    <div className="relative flex-1 overflow-hidden">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            <button onClick={handleNewSession} className="w-full flex flex-col items-start gap-1 p-3 rounded hover:bg-gray-800 text-sm border border-gray-700/50 mb-2 transition-colors text-white">
                                <div className="flex items-center gap-2"><Plus size={16}/> <span className="font-bold">New Conversation</span></div>
                                <div className="text-[11px] text-gray-400">Click to create a new conversation</div>
                            </button>
                            <div className="text-[10px] uppercase text-gray-600 font-bold px-2 pt-2">Active Drive: {selectedDrive} / Slot {selectedSlot}</div>
                            <div className="text-[10px] uppercase text-gray-600 font-bold px-2 pt-2">Conversation History</div>
                            {/* Show only conversations from the past 31 days */}
                            {(() => {
                                const now = Date.now();
                                const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;
                                const recent = currentFiles.filter((f:any) => {
                                    try { const t = new Date(f.timestamp).getTime(); return !isNaN(t) && (now - t) <= THIRTY_ONE_DAYS; } catch { return false; }
                                });
                                if (recent.length === 0) {
                                    return <div className="text-xs text-gray-500 p-2 italic">No conversations in this slot for the past 31 days.</div>;
                                }
                                return recent.map((f:any) => (
                                    <div key={f.id} className={`w-full flex items-center justify-between p-1 mb-1 transition-all ${activeFileId === f.id ? 'bg-cyan-900/10 border-l-2 border-cyan-500' : ''}`}>
                                        <div onClick={() => handleLoadChat(f)} className="flex-1 text-left p-3 text-xs cursor-pointer">
                                            <div className="font-bold truncate">{f.title}</div>
                                            <div className="text-[9px] opacity-50">{new Date(f.timestamp).toLocaleString()}</div>
                                        </div>
                                        <div className="flex gap-1 pr-2">
                                            <button title="Rename" onClick={(e)=>{ e.stopPropagation(); handleRename(f); }} className="p-1 rounded hover:bg-gray-800 text-gray-400"><Settings size={14}/></button>
                                            <button title="Delete" onClick={(e)=>{ e.stopPropagation(); handleDelete(f); }} className="p-1 rounded hover:bg-red-800 text-gray-400"><X size={14}/></button>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-800 space-y-2">
                        {/* MEMORY LAKE BUTTON (Moved Here) */}
                        <button onClick={() => setShowMemoryLake(true)} className="w-full flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-cyan-500/50 text-xs text-gray-400 transition-all group">
                            <HardDrive size={16} className="group-hover:text-cyan-400"/> 
                            <span className="font-bold tracking-wide">MEMORY LAKE</span>
                        </button>

                        <button onClick={()=>setShowDocs(true)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-cyan-500 px-2 py-1"><BookOpen size={14}/> Docs</button>

                        <button onClick={()=>setShowSettings(true)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-cyan-500 px-2 py-1"><Settings size={14}/> System Settings</button>
                        
                        <div className="text-[9px] text-gray-600 font-mono leading-tight px-2 pt-2">
                            <div className="text-cyan-900/60 font-bold">POWERED BY</div>
                            <div className="text-gray-500">LEEWAY INNOVATION</div>
                            <div className="text-gray-700 mt-1">A Leeway Industries Product</div>
                        </div>
                        <div className="p-3 border-t border-gray-800">
                            <button onClick={() => { console.log('[Trash] Button clicked, opening trash system'); setShowTrashSystem(true); }} className="w-full flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-red-500 text-xs text-gray-400 transition-all group">
                                <X size={14} className="group-hover:text-red-400"/>
                                <span className="font-bold tracking-wide">Trash Engine</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. CENTER SPACER */}
                <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
                    {!leftOpen && <button onClick={()=>{console.log('[Sidebar] Opening left panel'); setLeftOpen(true);}} title="Open sidebar" aria-label="Open sidebar" className="absolute top-4 left-4 p-2 bg-gray-900 rounded text-gray-400 z-50 hover:text-white pointer-events-auto shadow-lg border border-gray-800"><PanelLeftOpen/></button>}
                    {!rightOpen && <button onClick={()=>{console.log('[Sidebar] Opening right panel'); setRightOpen(true);}} title="Open panel" aria-label="Open panel" className="absolute top-4 right-4 p-2 bg-gray-900 rounded text-gray-400 z-50 hover:text-white pointer-events-auto shadow-lg border border-gray-800"><PanelRightOpen/></button>}
                    
                    <div className="absolute top-10 flex flex-col items-center z-10 pointer-events-none">
                         <div className={`px-4 py-1 rounded-full border ${agentStatus==='ACTING'?'border-cyan-500 bg-cyan-900/20 text-cyan-400': agentStatus==='THINKING'?'border-purple-500 bg-purple-900/20 text-purple-400': agentStatus==='SPEAKING' ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-gray-800 bg-black/50 text-gray-500'} text-xs font-mono tracking-widest backdrop-blur`}>
                             {agentStatus}
                         </div>
                         {agentStatus === 'THINKING' && (
                             <div className="mt-2 text-[10px] text-purple-400/60 animate-pulse font-mono">
                                 NEURAL INFERENCE...
                             </div>
                         )}
                    </div>

                    {!rightOpen && (
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto">
                             <button title="Microphone" aria-label="Microphone" onClick={handleMicClick} className={`p-5 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.8)] border-2 transition-all transform hover:scale-105 active:scale-95 ${agentStatus==='LISTENING' ? 'bg-red-600 border-red-400 animate-pulse' : (['SPEAKING', 'THINKING', 'ACTING', 'ANALYZING'].includes(agentStatus) ? 'bg-red-900/80 border-red-500 hover:bg-red-800' : 'bg-cyan-600 border-cyan-400 hover:bg-cyan-500')}`}>
                                 {agentStatus==='LISTENING' ? <MicOff className="text-white w-6 h-6"/> : (['SPEAKING', 'THINKING', 'ACTING', 'ANALYZING'].includes(agentStatus) ? <Square className="text-red-200 w-6 h-6 fill-current animate-pulse"/> : <Mic className="text-white w-6 h-6"/>)}
                             </button>
                        </div>
                    )}
                </div>

                {/* 3. RIGHT PANEL */}
                <div className={`fixed inset-y-0 right-0 z-50 bg-[#0a0a0a] border-l border-gray-800 transition-all duration-300 md:relative flex flex-col shrink-0 pointer-events-auto shadow-2xl ${rightOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full'} md:translate-x-0`}>
                    <div className="w-full flex flex-col h-full overflow-hidden"> 
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-400">CONVERSATION BOARD</span>
                            </div>
                            <button onClick={()=>{console.log('[Sidebar] Closing right panel'); setRightOpen(false);}} title="Close panel" aria-label="Close panel" className="text-gray-500 hover:text-white"><PanelRightClose size={18}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-lg text-sm ${m.role==='user'?'bg-cyan-900/30 border border-cyan-800 text-cyan-100':'bg-gray-800/50 border border-gray-700 text-gray-300'}`}>
                                        {m.type === 'image' ? <div className="italic text-xs flex items-center gap-1"><ImageIcon size={12}/> Image Uploaded</div> : <ReactMarkdown>{m.text}</ReactMarkdown>}
                                    </div>
                                </div>
                            ))}
                            <div ref={msgsEndRef}/>
                        </div>

                        <div className="p-4 border-t border-gray-800 bg-[#09090b] shrink-0">
                            <div className="flex items-center gap-2 mb-2">
                                <button onClick={()=>setShowCamera(true)} title="Open camera" aria-label="Open camera" className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-cyan-400"><Camera size={16}/></button>
                                <label className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-cyan-400 cursor-pointer" title="Upload File" aria-label="Upload file">
                                    <input type="file" className="hidden" onChange={(e)=>{
                                        const f = (e.target as HTMLInputElement)?.files?.[0];
                                        if(f) {
                                            setMessages(p=>[...p, {role:'user', text: `Uploaded ${f.name}`}]);
                                        }
                                    }}/>
                                    <Paperclip size={16}/>
                                </label>
                                <button 
                                    onClick={() => setWebSearchActive(!webSearchActive)}
                                    title="Toggle web search" aria-label="Toggle web search"
                                    className={`p-2 rounded hover:bg-gray-800 transition-all ${webSearchActive ? 'text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.4)] bg-cyan-900/20' : 'text-gray-400 hover:text-cyan-400'}`}
                                >
                                    <Globe size={16}/>
                                </button>
                                <button 
                                    onClick={() => setShowEmailCenter(true)}
                                    title="Open email center" aria-label="Open email center"
                                    className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-cyan-400 transition-colors"
                                >
                                    <Mail size={16}/>
                                </button>
                                {/* PHONE BUTTON */}
                                <button 
                                    onClick={() => setShowPhone(true)}
                                    title="Secure communications" aria-label="Open secure communications"
                                    className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-cyan-400 transition-colors"
                                >
                                    <Phone size={16}/>
                                </button>
                                <button className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-cyan-400" title="Download chat" aria-label="Download chat"><Download size={16}/></button>
                                
                                <button onClick={saveConversation} title="Save to slot" aria-label="Save to slot" className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-purple-400 ml-auto"><Save size={16}/></button>
                            </div>
                            <div className="flex gap-2 relative">
                                {/* FLOATING CONTROL ACTIONS */}
                                <div className="absolute bottom-14 right-2 z-30 flex flex-col gap-2 items-end pointer-events-none">
                                    {/* STOP BUTTON (Small Local) */}
                                    {['SPEAKING', 'THINKING', 'ACTING', 'ANALYZING'].includes(agentStatus) && (
                                        <button 
                                            onClick={interruptAgent}
                                            className="pointer-events-auto bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse flex items-center gap-2 border border-red-400 transition-transform active:scale-95"
                                        >
                                            <Square size={10} fill="currentColor"/> STOP
                                        </button>
                                    )}

                                    {/* CONTINUE BUTTON (Floating) */}
                                    {agentStatus === 'IDLE' && messages.length > 0 && (
                                         <button 
                                            onClick={() => handleSend("Please continue.")} 
                                            className="pointer-events-auto bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-cyan-900/50 hover:border-cyan-500 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2 transition-all backdrop-blur-md"
                                        >
                                            <FastForward size={10}/> CONTINUE
                                        </button>
                                    )}
                                </div>

                                <textarea 
                                    value={input}
                                    onChange={(e)=>setInput(e.target.value)}
                                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                    placeholder="Type a command or query..."
                                    className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:border-cyan-500 resize-none h-24 custom-scrollbar"
                                />
                                    <button onClick={()=>handleSend()} title="Send message" aria-label="Send message" className="absolute bottom-2 right-2 p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white shadow-lg"><Send size={16}/></button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* BOOT LAYER (ON TOP) */}
            {!consented && (
              <div className="absolute inset-0 z-[100] bg-black">
                <AgentLeeBootScreen onInitialize={handleBootInitialize} />
              </div>
            )}

            {/* SMART TRASH SYSTEM */}
            {showTrashSystem && (
                <SmartTrashSystem isOpen={showTrashSystem} onClose={() => setShowTrashSystem(false)} />
            )}
        </div>
    );
};

export default function App() {
    useEffect(() => {
        try {
            const registry = createToolRegistry();
            const store = createIndexedDBStore();
            const rag = createRagCore();
            const cad = createCadClientKernel();
            const win: any = window as any;
            win.__AGENT_LEE_TOOL_REGISTRY__ = registry;
            win.__AGENT_LEE_MEMORY_LAKE__ = store;
            win.__AGENT_LEE_RAG__ = rag;
            win.__AGENT_LEE_CAD__ = cad;
            const unregisterVoice = registerVoiceTools(AGENT_CONTROL);
            console.info('[App] Agent Lee core services initialized');
        } catch (e) {
            console.warn('[App] Failed to initialize Agent Lee core services', e);
        }
    }, []);
    return (
        <StyleEngineProvider enableLocalModel={false}>
            <VoiceRuntimeProvider>
                <AgentLeeInterface />
            </VoiceRuntimeProvider>
        </StyleEngineProvider>
    );
}
