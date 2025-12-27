/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.VOICESETTINGS.MAIN
   REGION: 🔵 UI
   VERSION: 1.0.1
   ============================================================================
   SystemSettingsVoicePanel.tsx

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

import React, { useMemo, useState } from "react";
import { useWebSpeechTTS } from "./useWebSpeechTTS";
import { updateVoiceConfig } from "./voiceStore";

export const SystemSettingsVoicePanel: React.FC = () => {
  const { voices, refreshVoices, speak, stop, resolved } = useWebSpeechTTS();
  const [sample, setSample] = useState("Agent Lee online. Voice confirmed.");

  const cfg = resolved.cfg;

  const grouped = useMemo(() => {
    const out: Record<string, SpeechSynthesisVoice[]> = {};
    for (const v of voices) {
      const k = (v.lang || "unknown").split("-")[0];
      out[k] = out[k] || [];
      out[k].push(v);
    }
    return out;
  }, [voices]);

  return (
    <div className="border border-gray-800 rounded-xl p-4 bg-black/40">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Voice</div>
        <button
          className="text-xs px-2 py-1 border border-gray-700 rounded"
          onClick={refreshVoices}
        >
          Refresh voices
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-300">
        Resolved voice:{" "}
        <span className="text-white">
          {resolved.voice ? `${resolved.voice.name} (${resolved.voice.lang})` : "None"}
        </span>{" "}
        <span className="text-gray-500">[{resolved.reason}]</span>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-gray-800 rounded-lg p-3">
          <div className="text-xs font-semibold mb-2">Voice Profile (portable)</div>

          <label className="text-[11px] block mb-1 text-gray-400">Language</label>
          <input
            id="voice-langFull"
            name="voice-langFull"
            className="w-full text-xs bg-black border border-gray-800 rounded px-2 py-1"
            value={cfg.profile.langFull ?? ""}
            onChange={(e) =>
              updateVoiceConfig({
                profile: {
                  langFull: e.target.value,
                  langBase: (e.target.value || "en").split("-")[0],
                },
              })
            }
            placeholder="en-US"
          />

          <label className="text-[11px] block mt-3 mb-1 text-gray-400">Gender hint</label>
          <select
            id="voice-gender"
            name="voice-gender"
            className="w-full text-xs bg-black border border-gray-800 rounded px-2 py-1"
            value={cfg.profile.gender ?? "neutral"}
            onChange={(e) =>
              updateVoiceConfig({ profile: { gender: e.target.value as any } })
            }
            title="Gender hint"
            aria-label="Gender hint"
          >
            <option value="neutral">neutral</option>
            <option value="female">female</option>
            <option value="male">male</option>
          </select>

          <label className="text-[11px] block mt-3 mb-1 text-gray-400">Name hints (comma)</label>
          <input
            id="voice-nameHints"
            name="voice-nameHints"
            className="w-full text-xs bg-black border border-gray-800 rounded px-2 py-1"
            value={(cfg.profile.nameHints ?? []).join(",")}
            onChange={(e) =>
              updateVoiceConfig({
                profile: {
                  nameHints: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="jenny,zira,samantha"
            title="Name hints"
            aria-label="Name hints"
          />

          <label className="text-[11px] block mt-3 mb-1 text-gray-400">
            Pinned voiceURI (same-browser only)
          </label>
          <input
            id="voice-pinnedVoiceURI"
            name="voice-pinnedVoiceURI"
            className="w-full text-xs bg-black border border-gray-800 rounded px-2 py-1"
            value={cfg.profile.pinnedVoiceURI ?? ""}
            onChange={(e) =>
              updateVoiceConfig({ profile: { pinnedVoiceURI: e.target.value || undefined } })
            }
            placeholder="auto"
            title="Pinned voiceURI"
            aria-label="Pinned voiceURI"
          />

          <div className="mt-3 flex gap-2">
            <button className="text-xs px-2 py-1 border border-gray-700 rounded" onClick={() => speak(sample)}>
              Test
            </button>
            <button className="text-xs px-2 py-1 border border-gray-700 rounded" onClick={stop}>
              Stop
            </button>
          </div>

          <textarea
            id="voice-sample"
            name="voice-sample"
            className="mt-2 w-full text-xs bg-black border border-gray-800 rounded px-2 py-1"
            rows={3}
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            placeholder="Sample text to speak"
            title="Sample text to speak"
            aria-label="Sample text to speak"
          />
        </div>

        <div className="border border-gray-800 rounded-lg p-3">
          <div className="text-xs font-semibold mb-2">Tuning</div>

          <TuningSlider
            label="Rate"
            value={cfg.tuning.rate}
            min={0.7}
            max={1.3}
            step={0.01}
            onChange={(v) => updateVoiceConfig({ tuning: { rate: v } })}
          />
          <TuningSlider
            label="Pitch"
            value={cfg.tuning.pitch}
            min={0.8}
            max={1.2}
            step={0.01}
            onChange={(v) => updateVoiceConfig({ tuning: { pitch: v } })}
          />
          <TuningSlider
            label="Volume"
            value={cfg.tuning.volume}
            min={0.2}
            max={1.0}
            step={0.01}
            onChange={(v) => updateVoiceConfig({ tuning: { volume: v } })}
          />

          <label className="text-[11px] block mt-3 mb-1 text-gray-400">Interrupt mode</label>
          <select
            id="voice-interruptMode"
            name="voice-interruptMode"
            className="w-full text-xs bg-black border border-gray-800 rounded px-2 py-1"
            value={cfg.interruptMode}
            onChange={(e) => updateVoiceConfig({ interruptMode: e.target.value as any })}
            title="Interrupt mode"
            aria-label="Interrupt mode"
          >
            <option value="cancel">cancel (replace speech)</option>
            <option value="queue">queue (append sentences)</option>
          </select>

          <div className="mt-4 text-xs text-gray-400">
            Available voices: <span className="text-gray-200">{voices.length}</span>
          </div>

          <div className="mt-2 max-h-48 overflow-auto border border-gray-900 rounded p-2">
            {Object.entries(grouped).map(([k, vs]) => (
              <div key={k} className="mb-2">
                <div className="text-[11px] text-gray-500 mb-1">{k.toUpperCase()}</div>
                <div className="flex flex-col gap-1">
                  {vs.slice(0, 12).map((v) => (
                    <button
                      key={v.voiceURI}
                      className="text-left text-xs px-2 py-1 border border-gray-900 rounded hover:border-gray-700"
                      onClick={() => updateVoiceConfig({ profile: { pinnedVoiceURI: v.voiceURI } })}
                      title="Pin this voiceURI (best effort)"
                    >
                      {v.name} <span className="text-gray-500">({v.lang})</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TuningSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, onChange }) => {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>{label}</span>
        <span className="text-gray-200">{value.toFixed(2)}</span>
      </div>
      <input
        id={`tuning-${label.toLowerCase()}`}
        name={`tuning-${label.toLowerCase()}`}
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        title={label}
        aria-label={label}
      />
    </div>
  );
};
