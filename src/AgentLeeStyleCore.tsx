/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.AGENTLEESTYLECORE.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   AgentLeeStyleCore.tsx
   
   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=support;
     INTENT_SCOPE=n/a;
     LOCATION_DEP=none;
     VERTICALS=n/a;
     RENDER_SURFACE=in-app;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ */


// src/AgentLeeStyleCore.tsx
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
// Dynamically load transformers to avoid bundling large runtime
let _transformers_core: any = null;
async function loadTransformersCore() {
  if (_transformers_core) return _transformers_core;

  // No Node shims in browser context; rely on boot initializer to set up env

  _transformers_core = await import('@xenova/transformers');

  try {
    // If ONNX backend exported an `env`, shallow-merge it into env.backends.onnx
    try {
      const onnxEnv = (_transformers_core as any).ONNX?.env;
      (_transformers_core as any).env = (_transformers_core as any).env || {};
      (_transformers_core as any).env.backends = (_transformers_core as any).env.backends || {};
      if (onnxEnv && typeof onnxEnv === 'object') {
        (_transformers_core as any).env.backends.onnx = (_transformers_core as any).env.backends.onnx || {};
        Object.assign((_transformers_core as any).env.backends.onnx, onnxEnv);
      }
    } catch (e) { /* ignore */ }

    // Normalize env IN PLACE — do not replace the env object reference.
    try {
      const envRef: any = (_transformers_core.env && typeof _transformers_core.env === 'object') ? _transformers_core.env : null;
      if (!envRef) {
        throw new Error('[loadTransformersCore] transformers env missing - ensure initTransformersEnv() is awaited at startup');
      }

      // Respect env that was initialized at startup. Only mutate missing nested keys (do not replace env).
      envRef.useBrowserCache = envRef.useBrowserCache ?? true;
      envRef.useFSCache = envRef.useFSCache ?? false;
      envRef.localModelPath = envRef.localModelPath ?? '/models/';

      envRef.backends = (envRef.backends && typeof envRef.backends === 'object') ? envRef.backends : (envRef.backends = {});
      envRef.backends.onnx = (envRef.backends.onnx && typeof envRef.backends.onnx === 'object') ? envRef.backends.onnx : (envRef.backends.onnx = {});
      envRef.backends.onnx.wasm = (envRef.backends.onnx.wasm && typeof envRef.backends.onnx.wasm === 'object') ? envRef.backends.onnx.wasm : (envRef.backends.onnx.wasm = {});
      envRef.backends.onnx.wasm.wasmPaths = envRef.backends.onnx.wasm.wasmPaths ?? '/onnx/';

    } catch (e) {
      // keep going if normalization fails
      console.warn('[loadTransformersCore] env normalization failed', e);
    }
  } catch (e) { console.warn('[loadTransformersCore] post-import adjustments failed', e); }

  return _transformers_core;
}

// ==========================
// Types & interfaces
// ==========================

export type ToneMode =
  | "deep-engineering"
  | "explainer"
  | "executive-summary";

export interface TonePreset {
  id: string;
  styleInstruction: string;
}

export interface PhraseMemoryStore {
  choosePhrase(
    mode: ToneMode,
    kind: "opener" | "closer",
    defaultText: string
  ): string;

  rememberFeedback?(
    mode: ToneMode,
    kind: "opener" | "closer",
    phrase: string,
    signal: "like" | "dislike"
  ): void;
}

// ==========================================
// StyleCore: single source of truth
// ==========================================

class StyleCore {
  static humanize(raw: string, mode?: ToneMode): string {
    if (!raw) return "";

    let text = raw.trim();

    // Normalize whitespace
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/[ \t]{2,}/g, " ");

    // Remove generic model openers
    const boringOpeners = [
      /^as an ai language model[, ]*/i,
      /^sure[, ]+here('?s)? (?:what|how)/i,
      /^of course[, ]*/i,
      /^absolutely[, ]*/i,
      /^great question[, ]*/i,
      /^let'?s break this down[, ]*/i,
    ];
    for (const pattern of boringOpeners) {
      text = text.replace(pattern, "");
    }

    // Filler transitions
    const fillerMap: Array<[RegExp, string]> = [
      [/^in conclusion[, ]*/gim, ""],
      [/^to summarize[, ]*/gim, ""],
      [/^in summary[, ]*/gim, ""],
      [/^overall[, ]*/gim, ""],
      [/^first(?:ly)?[, ]*/gim, "First, "],
      [/^second(?:ly)?[, ]*/gim, "Second, "],
      [/^third(?:ly)?[, ]*/gim, "Third, "],
    ];
    for (const [pattern, replacement] of fillerMap) {
      text = text.replace(pattern, replacement);
    }

    // Jargon cleanup
    const phraseSubs: Array<[RegExp, string]> = [
      [/\bleverage\b/gi, "use"],
      [/\butilize\b/gi, "use"],
      [/\benable us to\b/gi, "let us"],
      [/\bwith respect to\b/gi, "about"],
      [/\bas well as\b/gi, "and"],
    ];
    for (const [pattern, replacement] of phraseSubs) {
      text = text.replace(pattern, replacement);
    }

    text = text.replace(/\bthat that\b/gi, "that");

    // Clean bullet-only lines
    text = text
      .split("\n")
      .map((line) => line.replace(/^[\-\•\*]\s*$/, "").trimEnd())
      .join("\n");

    // Subtle mode-dependent tweaks
    if (mode === "deep-engineering") {
      text = text.replace(/\binsights\b/gi, "details");
      text = text.replace(/\bwe'll\b/gi, "we will");
    } else if (mode === "executive-summary") {
      text = text.replace(/;[^\.!?]+/g, "");
    }

    return text.trim();
  }

  static rewriteHeuristic(
    rawAnswer: string,
    opts: { mode: ToneMode; preset: TonePreset }
  ): string {
    const human = StyleCore.humanize(rawAnswer, opts.mode);
    if (!human) return "";

    const { mode } = opts;

    if (mode === "deep-engineering") {
      const lines = human
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const engineered = lines.map((line) => {
        if (
          /^(step\s*\d+[:.)]|first[, ]|second[, ]|third[, ]|fourth[, ])/i.test(
            line
          )
        ) {
          return `- ${line.replace(/^step\s*\d+[:.)]\s*/i, "")}`;
        }

        if (/^[\-\*\•]\s+/.test(line)) {
          return line.replace(/^[\-\*\•]\s+/, "- ");
        }

        return line;
      });

      return engineered.join("\n");
    }

    if (mode === "executive-summary") {
      const sentences = human
        .split(/(?<=[\.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const lead = sentences.slice(0, 2).join(" ");
      const bullets = sentences
        .slice(2)
        .slice(0, 7)
        .map((s) => `- ${s}`);

      return [lead, bullets.length ? "" : "", ...bullets].join("\n").trim();
    }

    // Explainer mode
    const paragraphs = human
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    const [first, ...rest] = paragraphs;

    const out: string[] = [];
    if (first) {
      out.push("Big picture:");
      out.push(first);
    }

    if (rest.length) {
      out.push("");
      out.push("Then, step by step:");
      for (const p of rest) {
        const lines = p
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean);
        for (const l of lines) {
          out.push(`- ${l}`);
        }
      }
    }

    out.push(
      "",
      "In other words, you can move through these steps one at a time without needing to know everything upfront."
    );

    return out.join("\n").trim();
  }
}

// ==========================================
// Phrase memory (micro-memory implementation)
// ==========================================

interface PhraseRecord {
  phrase: string;
  score: number; // likes - dislikes
}

type PhraseMemoryState = {
  [mode in ToneMode]?: {
    [kind in "opener" | "closer"]?: PhraseRecord[];
  };
};

class LocalPhraseMemory implements PhraseMemoryStore {
  private key = "agentLee_phrase_memory_v1";
  private state: PhraseMemoryState = {};

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(this.key);
        if (raw) {
          this.state = JSON.parse(raw);
        }
      } catch {
        this.state = {};
      }
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(this.state));
    } catch {
      // ignore
    }
  }

  choosePhrase(
    mode: ToneMode,
    kind: "opener" | "closer",
    defaultText: string
  ): string {
    const bucket = this.state[mode]?.[kind];
    if (!bucket || bucket.length === 0) {
      return defaultText;
    }

    const sorted = [...bucket].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    if (!top || top.score <= 0) return defaultText;
    return top.phrase;
  }

  rememberFeedback(
    mode: ToneMode,
    kind: "opener" | "closer",
    phrase: string,
    signal: "like" | "dislike"
  ): void {
    if (!phrase.trim()) return;

    if (!this.state[mode]) this.state[mode] = {};
    if (!this.state[mode]![kind]) this.state[mode]![kind] = [];

    const bucket = this.state[mode]![kind]!;
    const existing = bucket.find((r) => r.phrase === phrase);
    const delta = signal === "like" ? 1 : -1;

    if (existing) {
      existing.score += delta;
    } else {
      bucket.push({ phrase, score: delta });
    }

    // Keep only top 10 phrases per bucket
    this.state[mode]![kind] = bucket
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    this.persist();
  }
}

// ==========================================
// LocalStyleRewriter
// ==========================================

class LocalStyleRewriter {
  private modelName: string;
  private allowLocalRewrites: boolean;
  private pipe: any | null = null;
  private isLoading = false;

  constructor(
    opts: {
      modelName?: string;
      allowLocalRewrites?: boolean;
    } = {}
  ) {
    this.modelName = opts.modelName ?? "Qwen/Qwen2.5-0.5B";
    this.allowLocalRewrites = opts.allowLocalRewrites ?? false;
  }

  private async getPipeline(): Promise<any> {
    if (!this.allowLocalRewrites) {
      throw new Error("Local rewrites disabled");
    }
    if (this.pipe) return this.pipe;
    if (this.isLoading) {
      while (this.isLoading && !this.pipe) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.pipe) return this.pipe;
    }
    this.isLoading = true;
    try {
      const { pipeline } = await loadTransformersCore();
      const p = await pipeline("text-generation", this.modelName, {
        progress_callback: (progress: any) => {
          if (
            progress?.status === "downloading" &&
            typeof progress.total === "number" &&
            typeof progress.loaded === "number"
          ) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            window.dispatchEvent(
              new CustomEvent("llmLoadingProgress", {
                detail: { model: "local-style", progress: pct },
              })
            );
          }
        },
      });
      this.pipe = p;
      return p;
    } finally {
      this.isLoading = false;
    }
  }

  private stripEcho(prompt: string, generated: string): string {
    if (!generated) return "";
    const p = prompt.trim();
    const g = generated.trim();
    if (!p || !g.startsWith(p)) return g;
    return g.slice(p.length).trimStart();
  }

  async rewrite(
    rawAnswer: string,
    opts: {
      mode: ToneMode;
      preset: TonePreset;
      phraseMemory: PhraseMemoryStore;
    }
  ): Promise<string> {
    const { mode, preset, phraseMemory } = opts;

    const defaultOpener =
      mode === "deep-engineering"
        ? "Let’s walk through this from an engineering standpoint."
        : mode === "explainer"
        ? "Let me break this down step by step."
        : "Here is the decision-ready summary.";

    const defaultCloser =
      mode === "deep-engineering"
        ? "That’s the concrete path to implement this technically."
        : mode === "explainer"
        ? "That’s the big idea and how the pieces fit together."
        : "Those are the key points you need to decide and act.";

    const opener = phraseMemory.choosePhrase(mode, "opener", defaultOpener);
    const closer = phraseMemory.choosePhrase(mode, "closer", defaultCloser);

    const prompt = [
      preset.styleInstruction,
      "",
      "Original answer:",
      rawAnswer.trim(),
      "",
      "Rewrite now:",
    ].join("\n");

    try {
      const pipe = await this.getPipeline();
      const out = await pipe(prompt, {
        max_new_tokens: 256,
        temperature: 0.4,
      });

      const generated =
        Array.isArray(out) && (out as any)[0]?.generated_text
          ? String((out as any)[0].generated_text).trim()
          : String(out).trim();

      const stripped = this.stripEcho(prompt, generated);
      const body = StyleCore.humanize(stripped, mode);

      return [opener, "", body, "", closer].join("\n").trim();
    } catch (err) {
      // console.warn("[LocalStyleRewriter] Fallback to heuristic:", err);
      const body = StyleCore.rewriteHeuristic(rawAnswer, {
        mode,
        preset,
      });
      return [opener, "", body, "", closer].join("\n").trim();
    }
  }
}

// ==========================================
// Tone presets
// ==========================================

const TONE_PRESETS: Record<ToneMode, TonePreset> = {
  "deep-engineering": {
    id: "deep-engineering",
    styleInstruction:
      "Rewrite this as a calm, direct senior engineer. Be concise, structured, and technical. Prefer bullets and concrete steps over fluff.",
  },
  explainer: {
    id: "explainer",
    styleInstruction:
      "Rewrite this as a patient technical explainer. Use clear language, short paragraphs, and a friendly walkthrough tone for a motivated learner.",
  },
  "executive-summary": {
    id: "executive-summary",
    styleInstruction:
      "Rewrite this as an executive summary. Lead with the key point, then list a few short bullets for decisions and next steps.",
  },
};

// ==========================================
// React context
// ==========================================

interface StyleEngineContextValue {
  mode: ToneMode;
  setMode: (m: ToneMode) => void;
  preset: TonePreset;
  styleText: (raw: string) => Promise<string>;
  phraseMemory: PhraseMemoryStore;
}

const StyleEngineContext = createContext<StyleEngineContextValue | null>(null);

export function useStyleEngine(): StyleEngineContextValue {
  const ctx = useContext(StyleEngineContext);
  if (!ctx) {
    throw new Error("useStyleEngine must be used within StyleEngineProvider");
  }
  return ctx;
}

interface StyleEngineProviderProps {
  children: ReactNode;
  defaultMode?: ToneMode;
  enableLocalModel?: boolean;
  modelName?: string;
}

export const StyleEngineProvider: React.FC<StyleEngineProviderProps> = ({
  children,
  defaultMode = "explainer",
  enableLocalModel = false,
  modelName,
}) => {
  const [mode, setMode] = useState<ToneMode>(defaultMode);
  const preset = useMemo(() => TONE_PRESETS[mode], [mode]);

  const phraseMemory = useMemo(() => new LocalPhraseMemory(), []);
  const rewriter = useMemo(
    () =>
      new LocalStyleRewriter({
        modelName,
        allowLocalRewrites: enableLocalModel,
      }),
    [enableLocalModel, modelName]
  );

  const styleText = useCallback(
    async (raw: string): Promise<string> => {
      if (!raw.trim()) return "";
      return rewriter.rewrite(raw, {
        mode,
        preset,
        phraseMemory,
      });
    },
    [mode, preset, phraseMemory, rewriter]
  );

  // Optionally: persist last mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("agentLee_last_tone_mode", mode);
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("agentLee_last_tone_mode");
      if (saved && (["deep-engineering", "explainer", "executive-summary"] as ToneMode[]).includes(saved as ToneMode)) {
        setMode(saved as ToneMode);
      }
    } catch {
      // ignore
    }
  }, []);

  const value: StyleEngineContextValue = {
    mode,
    setMode,
    preset,
    styleText,
    phraseMemory,
  };

  return (
    <StyleEngineContext.Provider value={value}>
      {children}
    </StyleEngineContext.Provider>
  );
};

// ==========================================
// Demo panel component (optional UI)
// ==========================================

interface AgentLeeStyleCorePanelProps {
  className?: string;
}

export const AgentLeeStyleCorePanel: React.FC<AgentLeeStyleCorePanelProps> = ({
  className,
}) => {
  const { mode, setMode } = useStyleEngine();

  return (
    <div
      className={
        className ??
        "border border-gray-800 bg-[#0a0a0f] rounded-xl p-4 text-sm flex flex-col gap-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-cyan-400 font-mono tracking-widest text-xs">STYLE CORE v1</div>
        <div className="flex gap-2 text-xs">
          <ModeButton
            label="ENGINEER"
            active={mode === "deep-engineering"}
            onClick={() => setMode("deep-engineering")}
          />
          <ModeButton
            label="EXPLAINER"
            active={mode === "explainer"}
            onClick={() => setMode("explainer")}
          />
          <ModeButton
            label="EXECUTIVE"
            active={mode === "executive-summary"}
            onClick={() => setMode("executive-summary")}
          />
        </div>
      </div>
      <div className="text-[10px] text-gray-500 font-mono">
          Current Tone: <span className="text-gray-300">{mode.toUpperCase()}</span>. <br/>
          Micro-memory enabled for phrase adaptation.
      </div>
    </div>
  );
};

interface ModeButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ label, active, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2 py-1 rounded border text-[10px] font-bold tracking-wider transition-all",
        active
          ? "border-cyan-500 bg-cyan-900/20 text-cyan-400"
          : "border-gray-700 bg-black text-gray-500 hover:border-gray-500 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
};
