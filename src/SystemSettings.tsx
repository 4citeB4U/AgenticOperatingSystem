/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.SYSTEMSETTINGS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   SystemSettings.tsx
   
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

import { GoogleGenAI, Modality } from "@google/genai";
import {
    Activity,
    AlertCircle,
    Chrome,
    Cpu,
    Eye,
    Globe,
    Hexagon,
    Layers,
    Monitor,
    Play,
    RotateCcw,
    Save,
    Settings,
    Smartphone,
    Square,
    Terminal,
    Volume2,
    X,
    Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AGENT_CONTROL } from './coreRegistry';
import { mlAdapter } from './memoryLakeAdapter';
import { isAllowed } from './policyClient';
import './SystemSettings.css';

/* ==================================================================================
 * 1. TYPES & INTERFACES
 * ================================================================================== */

export enum BrowserType {
  CHROME = 'Chrome',
  SAFARI = 'Safari',
  EDGE = 'Edge',
  FIREFOX = 'Firefox',
  OPERA = 'Opera',
  SAMSUNG = 'Samsung'
}

export interface VoiceOption {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
  voiceURI: string;
  gender?: 'male' | 'female';
  category?: string; 
  genAiVoice?: string;
}

export interface VoiceSettings {
  pitch: number;
  rate: number;
  volume: number;
  tone: number;
  [key: string]: number; // Index signature for generic tuner
}

export interface GraphicsSettings {
  bloomStrength: number;
  particleCount: number;
  hue: number;
  chromaticAberration: boolean;
  [key: string]: number | boolean; // Index signature for generic tuner
}

interface BrowserInfo {
  id: BrowserType;
  name: string;
  icon: string;
  description: string;
}

interface TunerRingConfig {
  key: string;
  label: string;
  color: string;
  min: number;
  max: number;
  format: (val: number) => string;
}

/* ==================================================================================
 * 2. CONSTANTS & DATA
 * ================================================================================== */

const BROWSERS: BrowserInfo[] = [
  { id: BrowserType.CHROME, name: 'Chrome', icon: 'chrome', description: 'Google Wavenet' },
  { id: BrowserType.SAFARI, name: 'Safari', icon: 'safari', description: 'Apple Neural' },
  { id: BrowserType.EDGE, name: 'Edge', icon: 'edge', description: 'Azure Neural' },
  { id: BrowserType.FIREFOX, name: 'Firefox', icon: 'firefox', description: 'Web Speech' },
  { id: BrowserType.OPERA, name: 'Opera', icon: 'opera', description: 'Chromium' },
  { id: BrowserType.SAMSUNG, name: 'Samsung', icon: 'samsung', description: 'Android' },
];

const BROWSER_PRESETS: Record<string, VoiceOption[]> = {
  [BrowserType.CHROME]: [
    { name: 'Google US English', lang: 'en-US', gender: 'female', category: 'Google', default: true, localService: false, voiceURI: 'google_us_english_f', genAiVoice: 'Kore' },
    { name: 'Google UK English Female', lang: 'en-GB', gender: 'female', category: 'Google', default: false, localService: false, voiceURI: 'google_uk_english_f', genAiVoice: 'Zephyr' },
    { name: 'Google US English Male', lang: 'en-US', gender: 'male', category: 'Google', default: false, localService: false, voiceURI: 'google_us_english_m', genAiVoice: 'Fenrir' },
    { name: 'Google UK English Male', lang: 'en-GB', gender: 'male', category: 'Google', default: false, localService: false, voiceURI: 'google_uk_english_m', genAiVoice: 'Charon' },
  ],
  [BrowserType.SAFARI]: [
    { name: 'Samantha', lang: 'en-US', gender: 'female', category: 'Apple', default: true, localService: true, voiceURI: 'com.apple.speech.synthesis.voice.samantha', genAiVoice: 'Kore' },
    { name: 'Daniel', lang: 'en-GB', gender: 'male', category: 'Apple', default: false, localService: true, voiceURI: 'com.apple.speech.synthesis.voice.daniel', genAiVoice: 'Charon' },
    { name: 'Karen', lang: 'en-AU', gender: 'female', category: 'Apple', default: false, localService: true, voiceURI: 'com.apple.speech.synthesis.voice.karen', genAiVoice: 'Zephyr' },
    { name: 'Fred', lang: 'en-US', gender: 'male', category: 'Apple', default: false, localService: true, voiceURI: 'com.apple.speech.synthesis.voice.fred', genAiVoice: 'Puck' },
  ],
  [BrowserType.EDGE]: [
    { name: 'Microsoft Jenny Neural', lang: 'en-US', gender: 'female', category: 'Microsoft', default: true, localService: false, voiceURI: 'en-US-JennyNeural', genAiVoice: 'Kore' },
    { name: 'Microsoft Guy Neural', lang: 'en-US', gender: 'male', category: 'Microsoft', default: false, localService: false, voiceURI: 'en-US-GuyNeural', genAiVoice: 'Fenrir' },
    { name: 'Microsoft Sonia Neural', lang: 'en-GB', gender: 'female', category: 'Microsoft', default: false, localService: false, voiceURI: 'en-GB-SoniaNeural', genAiVoice: 'Zephyr' },
    { name: 'Microsoft Ryan Neural', lang: 'en-GB', gender: 'male', category: 'Microsoft', default: false, localService: false, voiceURI: 'en-GB-RyanNeural', genAiVoice: 'Charon' },
  ],
  [BrowserType.FIREFOX]: [
    { name: 'Microsoft Zira Desktop', lang: 'en-US', gender: 'female', category: 'Microsoft', default: true, localService: true, voiceURI: 'microsoft_zira_desktop', genAiVoice: 'Zephyr' },
    { name: 'Microsoft David Desktop', lang: 'en-US', gender: 'male', category: 'Microsoft', default: false, localService: true, voiceURI: 'microsoft_david_desktop', genAiVoice: 'Fenrir' },
    { name: 'Microsoft Hazel Desktop', lang: 'en-GB', gender: 'female', category: 'Microsoft', default: false, localService: true, voiceURI: 'microsoft_hazel_desktop', genAiVoice: 'Kore' },
    { name: 'Microsoft Mark Desktop', lang: 'en-US', gender: 'male', category: 'Microsoft', default: false, localService: true, voiceURI: 'microsoft_mark_desktop', genAiVoice: 'Puck' },
  ],
  [BrowserType.OPERA]: [
    { name: 'Google US English', lang: 'en-US', gender: 'female', category: 'Google', default: true, localService: false, voiceURI: 'google_us_english_f_opera', genAiVoice: 'Kore' },
    { name: 'Google UK English Female', lang: 'en-GB', gender: 'female', category: 'Google', default: false, localService: false, voiceURI: 'google_uk_english_f_opera', genAiVoice: 'Zephyr' },
    { name: 'Google US English Male', lang: 'en-US', gender: 'male', category: 'Google', default: false, localService: false, voiceURI: 'google_us_english_m_opera', genAiVoice: 'Fenrir' },
    { name: 'Google UK English Male', lang: 'en-GB', gender: 'male', category: 'Google', default: false, localService: false, voiceURI: 'google_uk_english_m_opera', genAiVoice: 'Charon' },
  ],
  [BrowserType.SAMSUNG]: [
    { name: 'Samsung English Female 1', lang: 'en-US', gender: 'female', category: 'Samsung', default: true, localService: true, voiceURI: 'samsung_en_us_f1', genAiVoice: 'Kore' },
    { name: 'Samsung English Male 1', lang: 'en-US', gender: 'male', category: 'Samsung', default: false, localService: true, voiceURI: 'samsung_en_us_m1', genAiVoice: 'Fenrir' },
    { name: 'Samsung English Female 2', lang: 'en-GB', gender: 'female', category: 'Samsung', default: false, localService: true, voiceURI: 'samsung_en_gb_f1', genAiVoice: 'Zephyr' },
    { name: 'Samsung English Male 2', lang: 'en-GB', gender: 'male', category: 'Samsung', default: false, localService: true, voiceURI: 'samsung_en_gb_m1', genAiVoice: 'Puck' },
  ],
};

/* ==================================================================================
 * 3. UTILITIES
 * ================================================================================== */

const analyzeVoice = (voice: SpeechSynthesisVoice): VoiceOption => {
  const nameLower = voice.name.toLowerCase();
  let gender: 'male' | 'female' | undefined = undefined;
  
  if (nameLower.includes('female') || nameLower.includes('samantha') || nameLower.includes('zira') || nameLower.includes('jenny') || nameLower.includes('sonia') || nameLower.includes('hazel') || nameLower.includes('susan') || nameLower.includes('karen')) {
    gender = 'female';
  } else if (nameLower.includes('male') || nameLower.includes('daniel') || nameLower.includes('david') || nameLower.includes('james') || nameLower.includes('fred') || nameLower.includes('guy') || nameLower.includes('ryan') || nameLower.includes('george')) {
    gender = 'male';
  }

  let category = 'System';
  if (nameLower.includes('google')) category = 'Google';
  else if (nameLower.includes('microsoft')) category = 'Microsoft';
  else if (nameLower.includes('apple') || nameLower.includes('siri')) category = 'Apple';
  else if (nameLower.includes('samsung')) category = 'Samsung';

  return {
    name: voice.name,
    lang: voice.lang,
    default: voice.default,
    localService: voice.localService,
    voiceURI: voice.voiceURI,
    gender,
    category
  };
};

import { safeAtob } from './tools/safeBase64';

function decode(base64: string) {
  const binaryString = safeAtob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/* ==================================================================================
 * 4. HOOKS
 * ================================================================================== */

const useTTS = () => {
  const [availableRawVoices, setAvailableRawVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Refs for Web Audio API (GenAI)
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize GenAI
  const genAI = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    // Do not read API keys from environment in the browser build.
    if (isAllowed('GENAI_TTS')) {
      console.warn('[POLICY] Remote GenAI TTS allowed by policy, but no API key is available in the client. Remote TTS remains disabled.');
    }

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setAvailableRawVoices(allVoices);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update DSP parameters in real-time when settings change while playing
  const updateDSP = useCallback((settings: VoiceSettings) => {
    if (audioContextRef.current && sourceNodeRef.current && filterNodeRef.current && gainNodeRef.current) {
        const ctx = audioContextRef.current;
        const now = ctx.currentTime;
        
        // RATE
        sourceNodeRef.current.playbackRate.cancelScheduledValues(now);
        sourceNodeRef.current.playbackRate.linearRampToValueAtTime(settings.rate, now + 0.1);

        // PITCH (Detune)
        const detuneValue = (settings.pitch - 1) * 1200;
        sourceNodeRef.current.detune.cancelScheduledValues(now);
        sourceNodeRef.current.detune.linearRampToValueAtTime(detuneValue, now + 0.1);

        // TONE (Filter Cutoff)
        const minFreq = 500;
        const maxFreq = 16000;
        const frequency = minFreq * Math.pow(maxFreq / minFreq, settings.tone / 100);
        
        filterNodeRef.current.frequency.cancelScheduledValues(now);
        filterNodeRef.current.frequency.exponentialRampToValueAtTime(frequency, now + 0.1);

        // VOLUME
        gainNodeRef.current.gain.cancelScheduledValues(now);
        gainNodeRef.current.gain.linearRampToValueAtTime(settings.volume, now + 0.1);
    }
  }, []);

  const speak = useCallback(async (text: string, targetVoice: VoiceOption, settings: VoiceSettings) => {
    // STOP PREVIOUS
    window.speechSynthesis.cancel();
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current.disconnect();
    }
    setSpeaking(false);
    setLoading(true);

    // MODE 1: GOOGLE GENAI (High Fidelity) - guarded by policy
    if (targetVoice.genAiVoice && genAI.current && isAllowed('GENAI_TTS')) {
        try {
            const response = await genAI.current.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: targetVoice.genAiVoice },
                      },
                  },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data returned");

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            }
            const ctx = audioContextRef.current;

            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                ctx,
                24000,
                1,
            );

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            const gain = ctx.createGain();

            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            sourceNodeRef.current = source;
            filterNodeRef.current = filter;
            gainNodeRef.current = gain;

            updateDSP(settings);

            source.start();
            setSpeaking(true);
            setLoading(false);

            source.onended = () => setSpeaking(false);

        } catch (error) {
            console.error("GenAI TTS Error:", error);
            setLoading(false);
            // Fallback to local
            speakLocal(text, targetVoice, settings);
        }
        return;
    }

    // MODE 2: LOCAL FALLBACK
    speakLocal(text, targetVoice, settings);
    setLoading(false);

  }, [availableRawVoices, updateDSP]);

  const speakLocal = (text: string, targetVoice: VoiceOption, settings: VoiceSettings) => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // INTELLIGENT MATCHING
    let selectedVoice = availableRawVoices.find(v => v.voiceURI === targetVoice.voiceURI);
    
    if (!selectedVoice) selectedVoice = availableRawVoices.find(v => v.name.includes(targetVoice.name));
    if (!selectedVoice) {
       const targetLang = targetVoice.lang.split('-')[0];
       selectedVoice = availableRawVoices.find(v => {
           const vOpt = analyzeVoice(v);
           return v.lang.startsWith(targetLang) && vOpt.gender === targetVoice.gender;
       });
    }
    if (!selectedVoice) selectedVoice = availableRawVoices.find(v => v.lang.startsWith(targetVoice.lang.split('-')[0]));

    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.pitch = settings.pitch;
    utterance.rate = settings.rate;
    utterance.volume = settings.volume;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current.disconnect();
    }
    setSpeaking(false);
    setLoading(false);
  }, []);

  return { speak, stop, speaking, loading, updateDSP };
};

/* ==================================================================================
 * 5. SUB-COMPONENTS
 * ================================================================================== */

/* --- GENERIC PARAMETRIC TUNER --- */
interface ParametricTunerProps<T> {
  values: T;
  onChange: (newValues: T) => void;
  rings: TunerRingConfig[];
  onPlay?: () => void;
  onStop?: () => void;
  isPlaying?: boolean;
  showPlayButton?: boolean;
}

const ParametricTuner = <T extends Record<string, any>>({ 
  values, 
  onChange, 
  rings,
  onPlay, 
  onStop, 
  isPlaying = false,
  showPlayButton = true
}: ParametricTunerProps<T>) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeRing, setActiveRing] = useState<string | null>(null);

  const getAngle = (clientX: number, clientY: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return angle + 90; 
  };

  const handlePointerDown = (e: React.PointerEvent, ringKey: string) => {
    setActiveRing(ringKey);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setActiveRing(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeRing) return;

    const ringConfig = rings.find(r => r.key === activeRing);
    if (!ringConfig) return;

    const angle = getAngle(e.clientX, e.clientY);
    let workingAngle = angle;
    if (workingAngle > 180) workingAngle -= 360;
    if (workingAngle < -140) workingAngle = -140;
    if (workingAngle > 140) workingAngle = 140;

    const percent = (workingAngle + 140) / 280; // 0 to 1
    const range = ringConfig.max - ringConfig.min;
    const newValue = ringConfig.min + (percent * range);

    onChange({
      ...values,
      [activeRing]: newValue
    });
  };

  const valueToAngle = (val: number, min: number, max: number) => {
    const percent = (val - min) / (max - min);
    return -140 + (percent * 280);
  };

  const createArc = (radius: number, startAngle: number, endAngle: number) => {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const x1 = 150 + radius * Math.cos(startRad);
    const y1 = 150 + radius * Math.sin(startRad);
    const x2 = 150 + radius * Math.cos(endRad);
    const y2 = 150 + radius * Math.sin(endRad);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  // Base Radii for up to 3 rings
  const ringRadii = [135, 105, 75];

  return (
    <div className="relative w-full max-w-[300px] aspect-square flex items-center justify-center select-none mx-auto">
      <div className="absolute inset-0 bg-[#00ffff] opacity-5 rounded-full blur-2xl"></div>
      <svg 
        ref={svgRef}
        viewBox="0 0 300 300"
        className="w-full h-full relative z-10 drop-shadow-[0_0_10px_rgba(0,255,255,0.3)] touch-none no-touch-action"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {rings.map((ring, index) => {
            const radius = ringRadii[index] || 75 - (index * 30);
            const angle = valueToAngle(values[ring.key], ring.min, ring.max);
            
            return (
                <g key={ring.key}>
                    <path d={createArc(radius, -140, 140)} fill="none" stroke="#1a1a1a" strokeWidth="20" strokeLinecap="round"/>
                    <path d={createArc(radius, -140, angle)} fill="none" stroke={activeRing === ring.key ? ring.color : adjustColor(ring.color, -50)} strokeWidth="20" strokeLinecap="round" filter="url(#glow)"/>
                    <g transform={`rotate(${angle}, 150, 150)`}>
                    <circle cx="150" cy={150 - radius} r="8" fill={ring.color} className="cursor-pointer" onPointerDown={(e) => handlePointerDown(e, ring.key)}/>
                    </g>
                    <text x="150" y={150 - radius + 10} textAnchor="middle" fill={ring.color} fontSize="10" className="font-mono font-bold pointer-events-none select-none">{ring.label}</text>
                </g>
            );
        })}
      </svg>

      {showPlayButton && (
        <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <button
            onClick={isPlaying ? onStop : onPlay}
            aria-label={isPlaying ? 'Stop playback' : 'Play sample'}
            title={isPlaying ? 'Stop playback' : 'Play sample'}
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${isPlaying ? 'bg-[#0044ff] border-[#00ffff] shadow-[0_0_30px_#0044ff]' : 'bg-[#050505] border-gray-700 hover:border-[#00ffff] hover:shadow-[0_0_15px_#00ffff]'}`}
            >
            {isPlaying ? <Square className="w-6 h-6 md:w-8 md:h-8 text-white fill-current animate-pulse" /> : <Play className="w-6 h-6 md:w-8 md:h-8 text-[#00ffff] fill-current ml-1" />}
            </button>
        </div>
      )}

      {!showPlayButton && (
           <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
             <Hexagon className="w-16 h-16 text-[#00ffff] opacity-20 animate-pulse" />
           </div>
      )}

        <div className="absolute top-[85%] left-1/2 transform -translate-x-1/2 text-center pointer-events-none w-full">
        <div className="flex justify-center gap-2 md:gap-4 text-[10px] md:text-xs font-mono text-gray-500 mt-2">
          {rings.map(ring => (
           <div key={ring.key} className={`tuner-ring-label ring-${ring.key} ${activeRing === ring.key ? 'ring-active' : ''}`}>
             {ring.label.substring(0,3)}:{ring.format(values[ring.key])}
           </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper to darken color for inactive state
function adjustColor(color: string, percent: number) {
    // Basic hex support
    return color; // Simplified for now, relies on provided colors
}


/* --- BROWSER SELECTOR --- */
const BrowserSelector: React.FC<{ selected: BrowserType; onSelect: (b: BrowserType) => void }> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
      {BROWSERS.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className={`group relative p-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${selected === b.id ? 'bg-[#0a0a0f] border-[#00ffff] shadow-[0_0_15px_rgba(0,255,255,0.2)]' : 'bg-black border-gray-800 hover:border-gray-600 hover:bg-gray-900'}`}
        >
            <div className={`p-2 rounded-full ${selected === b.id ? 'bg-[rgba(0,255,255,0.1)] text-[#00ffff]' : 'bg-gray-900 text-gray-500'}`}>
                {b.id === BrowserType.CHROME && <Chrome size={20} />}
                {b.id === BrowserType.SAFARI && <Globe size={20} />}
                {b.id === BrowserType.EDGE && <Monitor size={20} />}
                {b.id === BrowserType.FIREFOX && <Globe size={20} />}
                {b.id === BrowserType.OPERA && <Globe size={20} />}
                {b.id === BrowserType.SAMSUNG && <Smartphone size={20} />}
            </div>
            <div className="text-center">
                <h3 className={`font-mono text-xs font-bold ${selected === b.id ? 'text-white' : 'text-gray-400'}`}>{b.name}</h3>
                <p className="text-[9px] text-gray-600 mt-0.5 font-sans uppercase tracking-wider">{b.description}</p>
            </div>
            {selected === b.id && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#00ffff] animate-pulse"></div>}
        </button>
      ))}
    </div>
  );
};

/* --- NEURAL VOICE TUNER (TAB CONTENT) --- */
interface NeuralVoiceTunerProps {
  initialText?: string;
  onConfigChange?: (config: {
    voice: VoiceOption | null;
    settings: VoiceSettings;
    browser: BrowserType;
  }) => void;
  className?: string;
}

const NeuralVoiceTuner: React.FC<NeuralVoiceTunerProps> = ({ 
  initialText = "System online. Agent Lee initialized. Awaiting input.",
  onConfigChange,
  className = ""
}) => {
  const { speak, stop, speaking, loading, updateDSP } = useTTS();
  const [selectedBrowser, setSelectedBrowser] = useState<BrowserType>(BrowserType.CHROME);
  const [displayedVoices, setDisplayedVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  
  const [text, setText] = useState(initialText);
  const [settings, setSettings] = useState<VoiceSettings>({ pitch: 1, rate: 1, volume: 1, tone: 50 });

  useEffect(() => {
    if (speaking) updateDSP(settings);
    if (onConfigChange) onConfigChange({ voice: selectedVoice, settings, browser: selectedBrowser });
  }, [settings, speaking, updateDSP, selectedVoice, selectedBrowser, onConfigChange]);

  useEffect(() => {
    const voices = BROWSER_PRESETS[selectedBrowser] || BROWSER_PRESETS[BrowserType.CHROME];
    setDisplayedVoices(voices);
    if (voices.length > 0) setSelectedVoice(voices[0]);
  }, [selectedBrowser]);

  const handlePlay = () => {
    if (!selectedVoice) return;
    speak(text, selectedVoice, settings);
  };

  const voiceRings: TunerRingConfig[] = [
      { key: 'tone', label: 'TONE', color: '#00ffff', min: 0, max: 100, format: (v) => `${Math.round(v)}%` },
      { key: 'pitch', label: 'PITCH', color: '#0044ff', min: 0.5, max: 2.0, format: (v) => v.toFixed(1) },
      { key: 'rate', label: 'RATE', color: '#ff00ff', min: 0.5, max: 2.0, format: (v) => `${v.toFixed(1)}x` },
  ];

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL (Bottom on Mobile) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="hidden lg:flex items-center gap-4 mb-8">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-[0_0_20px_#0044ff] transition-all duration-300 ${speaking ? 'bg-[#00ffff] animate-pulse' : 'bg-[#0044ff]'}`}>
              <Activity className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-white tracking-widest uppercase">Neural<span className="text-[#00ffff]">Tuner</span></h1>
              <p className="text-xs text-gray-500 font-mono tracking-widest flex items-center gap-2">SUB-ROUTINE: VOICE_SYNTHESIS_V2.1 {loading && <span className="text-[#00ffff] animate-pulse"> {'>>'} UPLOADING...</span>}</p>
            </div>
          </div>

          <section>
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-mono text-[#00ffff] uppercase tracking-wider flex items-center gap-2">Target Environment</h2>
            </div>
            <BrowserSelector selected={selectedBrowser} onSelect={setSelectedBrowser} />
          </section>

          <section className="bg-[#0a0a0f] border border-gray-800 rounded-2xl p-4 md:p-6 relative overflow-hidden transition-all duration-500">
             <div className={`absolute top-0 right-0 p-4 transition-all duration-500 pointer-events-none ${loading ? 'opacity-20 animate-pulse text-[#00ffff]' : 'opacity-5 text-gray-500'}`}><Cpu size={120} /></div>
             
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider">Top Neural Models ({selectedBrowser})</h2>
                {selectedVoice?.genAiVoice && (
                    <span className="text-[10px] font-mono text-[#00ffff] border border-[#00ffff]/30 px-2 py-0.5 rounded bg-[#00ffff]/10 flex items-center gap-1"><Zap size={10} className="fill-current" /> CLOUD ENHANCED</span>
                )}
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 h-64 overflow-y-auto pr-2 custom-scrollbar">
                {displayedVoices.map((voice) => (
                <button
                    key={voice.voiceURI}
                    onClick={() => setSelectedVoice(voice)}
                    className={`text-left p-3 rounded-lg border transition-all duration-200 group relative overflow-hidden ${selectedVoice?.voiceURI === voice.voiceURI ? 'bg-[rgba(0,255,255,0.1)] border-[#00ffff] shadow-[0_0_10px_rgba(0,255,255,0.1)]' : 'bg-black/50 border-gray-800 hover:border-gray-600'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border border-opacity-20 ${voice.gender === 'female' ? 'bg-pink-900/20 text-pink-400 border-pink-500' : 'bg-blue-900/20 text-blue-400 border-blue-500'}`}>{voice.gender ? voice.gender.toUpperCase() : 'SYSTEM'}</span>
                        {voice.genAiVoice && <span className="w-1.5 h-1.5 rounded-full bg-[#00ffff] animate-pulse shadow-[0_0_5px_#00ffff]" />}
                    </div>
                    <div className="font-bold text-sm truncate text-gray-200 group-hover:text-white transition-colors">{voice.name}</div>
                    <div className="text-[10px] text-gray-500 mt-1 flex justify-between font-mono"><span>{voice.lang}</span><span className={voice.genAiVoice ? "text-[#00ffff]" : "text-gray-600"}>{voice.genAiVoice ? `NEURAL (${voice.genAiVoice.toUpperCase()})` : 'LOCAL'}</span></div>
                </button>
                ))}
             </div>
          </section>

          <section>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
              className={`w-full bg-[#050505] border border-gray-800 rounded-xl p-4 text-[#00ffff] font-mono text-sm focus:outline-none focus:border-[#0044ff] focus:shadow-[0_0_15px_rgba(0,68,255,0.2)] h-32 resize-none transition-all ${loading ? 'opacity-50 cursor-wait' : ''}`}
              placeholder="ENTER SEQUENCE DATA..."
            />
          </section>
        </div>

        {/* RIGHT PANEL: TUNER (Top on Mobile) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-[#0a0a0f] border border-gray-800 rounded-3xl p-6 md:p-8 relative min-h-[400px] md:min-h-[500px]">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none rounded-3xl"></div>
           <div className="mb-8 text-center relative z-10">
              <h2 className="text-xl md:text-2xl font-mono font-bold text-white mb-2">PARAMETRIC TUNER</h2>
              <div className="flex items-center justify-center gap-4 text-xs font-mono">
                {voiceRings.map(r => (
                    <span key={r.key} className={`flex items-center gap-1 voice-ring voice-${r.key}`}><span className="w-2 h-2 rounded-full voice-dot voice-dot-${r.key}"></span>{r.label}</span>
                ))}
              </div>
           </div>

           <div className="relative z-10 w-full flex justify-center">
              <ParametricTuner 
                values={settings} 
                onChange={setSettings} 
                rings={voiceRings}
                onPlay={handlePlay} 
                onStop={stop} 
                isPlaying={speaking} 
              />
              <div className={`absolute -bottom-12 left-0 right-0 h-16 flex items-end justify-center gap-1 opacity-50 px-8 spectrum ${speaking ? 'speaking' : ''}`}>
                  {[...Array(24)].map((_, i) => (
                    <div key={i} className={`w-1.5 rounded-t-sm spectrum-bar bar-${i+1}`} />
                  ))}
              </div>
           </div>

           <div className="mt-16 w-full bg-black/40 rounded-xl p-4 border border-gray-800 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-[#00ffff] font-mono text-xs animate-pulse"><Cpu className="w-4 h-4" /> GENERATING NEURAL AUDIO STREAM...</div>
                ) : (
                    <>
                        <AlertCircle className="w-4 h-4 text-[#0044ff] mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-gray-500 leading-relaxed font-mono"><strong className="text-gray-300">DSP ACTIVE:</strong> Real-time Pitch, Rate, and Tone modulation enabled via AudioContext. Voices mapped to closest neural equivalent.</p>
                    </>
                )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

/* --- VISUALS TUNER (TAB CONTENT) --- */
interface VisualsTunerProps {
  settings: GraphicsSettings;
  onSettingsChange: (settings: GraphicsSettings) => void;
  className?: string;
}

const VisualsTuner: React.FC<VisualsTunerProps> = ({ settings, onSettingsChange, className = "" }) => {
    
    const visualRings: TunerRingConfig[] = [
        { key: 'hue', label: 'COLOR', color: '#00ffff', min: 0, max: 360, format: (v) => `${Math.round(v)}°` },
        { key: 'bloomStrength', label: 'BLOOM', color: '#0044ff', min: 0, max: 3, format: (v) => v.toFixed(1) },
        { key: 'particleCount', label: 'DENSITY', color: '#ff00ff', min: 5000, max: 50000, format: (v) => `${(v/1000).toFixed(0)}k` },
    ];

    // Dynamic color for the Hue ring
    const hueColor = `hsl(${settings.hue}, 100%, 50%)`;
    visualRings[0].color = hueColor;
    const rootRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      if (rootRef.current) {
        rootRef.current.style.setProperty('--hue', hueColor);
        rootRef.current.style.setProperty('--hue-opaque', `${hueColor}1a`);
      }
    }, [hueColor]);

    return (
      <div ref={rootRef} className={`w-full ${className}`}>
             <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8">
                
                {/* LEFT PANEL (Bottom on Mobile) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="hidden lg:flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-lg bg-[#0044ff] flex items-center justify-center shadow-[0_0_20px_#0044ff]">
                             <Eye className="text-white w-6 h-6" />
                        </div>
                        <div>
                        <h1 className="text-2xl font-mono font-bold text-white tracking-widest uppercase">Visual<span className="hue-text">Core</span></h1>
                        <p className="text-xs text-gray-500 font-mono tracking-widest">SUB-ROUTINE: VORTEX_RENDERER_V3.0</p>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0f] border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 hue-color"><Hexagon size={100} /></div>
                        <h3 className="text-xl font-mono text-white mb-6 flex items-center gap-2">
                        <Monitor className="hue-color" /> RENDER ENGINE
                        </h3>
                        
                        <div className="space-y-4">
                            <button 
                            onClick={() => onSettingsChange({...settings, chromaticAberration: !settings.chromaticAberration})}
                            className={`w-full p-4 border rounded-xl text-left transition-all ${settings.chromaticAberration ? 'chromatic-on' : 'chromatic-off'}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Zap size={20} className={settings.chromaticAberration ? 'hue-color' : 'text-gray-500'} />
                                    <div className={`w-2 h-2 rounded-full chroma-dot ${settings.chromaticAberration ? 'chroma-on' : ''}`} />
                                </div>
                                <h4 className="font-mono text-sm text-white">CHROMATIC ABERRATION</h4>
                                <p className="text-[10px] text-gray-500 mt-1">Simulate lens distortion artifacts.</p>
                            </button>

                            <div className="w-full p-4 border border-gray-800 bg-black rounded-xl opacity-50 cursor-not-allowed">
                                <div className="flex items-center justify-between mb-2">
                                    <Layers size={20} className="text-gray-600" />
                                    <div className="w-2 h-2 rounded-full bg-gray-800" />
                                </div>
                                <h4 className="font-mono text-sm text-gray-400">RAY TRACING (BETA)</h4>
                                <p className="text-[10px] text-gray-600 mt-1">Requires WebGPU Hardware Acceleration.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: TUNER (Top on Mobile) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center bg-[#0a0a0f] border border-gray-800 rounded-3xl p-6 md:p-8 relative min-h-[400px] md:min-h-[500px]">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none rounded-3xl"></div>
                    <div className="mb-8 text-center relative z-10">
                    <h2 className="text-xl md:text-2xl font-mono font-bold text-white mb-2">VISUAL MATRIX</h2>
                    <div className="flex items-center justify-center gap-4 text-xs font-mono">
                      {visualRings.map(r => (
                        <span key={r.key} className={`flex items-center gap-1 visual-ring ${r.key === 'hue' ? 'visual-ring-hue' : r.key === 'bloomStrength' ? 'visual-ring-bloom' : 'visual-ring-particle'}`}><span className={`w-2 h-2 rounded-full visual-dot ${r.key === 'hue' ? 'visual-dot-hue' : r.key === 'bloomStrength' ? 'visual-dot-bloom' : 'visual-dot-particle'}`}></span>{r.label}</span>
                      ))}
                    </div>
                  </div>

                    <div className="relative z-10 w-full flex justify-center">
                        <ParametricTuner 
                            values={settings} 
                            onChange={onSettingsChange} 
                            rings={visualRings}
                            showPlayButton={false}
                        />
                         <div className="absolute -bottom-12 left-0 right-0 h-16 flex items-end justify-center gap-1 opacity-50 px-8 visual-spectrum">
                          {[...Array(24)].map((_, i) => (
                            <div key={i} className={`w-1.5 rounded-t-sm visual-bar bar-${i+1}`} />
                          ))}
                        </div>
                    </div>
                    
                    <div className="mt-16 w-full bg-black/40 rounded-xl p-4 border border-gray-800 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                            <Monitor className="w-4 h-4 mt-0.5 flex-shrink-0 hue-color" />
                            <p className="text-[10px] text-gray-500 leading-relaxed font-mono">
                                <strong className="text-gray-300">CORE STATUS:</strong> 
                                Rendering {settings.particleCount.toLocaleString()} voxels with {settings.bloomStrength}x bloom intensity.
                            </p>
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
}

/* ==================================================================================
 * 6. SETTINGS MODAL
 * ================================================================================== */

type TabType = 'AUDIO' | 'VISUALS';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpen }) => {
  // Local state for voice/display settings so AGENT_CONTROL handlers have access
  const [displayedVoices, setDisplayedVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>({ pitch: 1, rate: 1, volume: 1, tone: 50 });

  // onOpen prop may be provided by the caller (SystemConfig)
  const [activeTab, setActiveTab] = useState<TabType>('AUDIO');
  const [isSaving, setIsSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Graphics State
  const [graphics, setGraphics] = useState<GraphicsSettings>({
    bloomStrength: 1.5,
    particleCount: 20000,
    hue: 180, // Cyan default
    resolutionScale: 1.0,
    chromaticAberration: true
  });

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedGraphics = localStorage.getItem('agent_lee_graphics');
    if (savedGraphics) {
      try {
        setGraphics(JSON.parse(savedGraphics));
      } catch (e) { console.error("Failed to parse graphics settings"); }
    }
  }, []);

  // ==============================
  // LEEWAY: AGENT_CONTROL LAYER
  // ==============================
  useEffect(() => {
    AGENT_CONTROL.register('SystemSettings', {
      openSettings: async () => {
        if (onOpen) onOpen();
        await mlAdapter.putEvent('agent/actions/settings/', `open_${Date.now()}`, {});
        return { ok: true };
      },
      closeSettings: async () => {
        onClose();
        await mlAdapter.putEvent('agent/actions/settings/', `close_${Date.now()}`, {});
        return { ok: true };
      },
      setTab: async ({ tab }: { tab: any }) => {
        setActiveTab(tab);
        await mlAdapter.putEvent('agent/actions/settings/', `tab_${Date.now()}`, { tab });
        return { ok: true };
      },
      setVoice: async ({ voiceURI }: { voiceURI: string }) => {
        const v = displayedVoices.find(x => x.voiceURI === voiceURI) || null;
        setSelectedVoice(v);
        await mlAdapter.putEvent('agent/actions/settings/', `voice_${Date.now()}`, { voiceURI });
        return { ok: true };
      },
      setVoiceTuner: async ({ key, value }: { key: string; value: number }) => {
        setSettings(prev => ({ ...prev, [key]: value } as VoiceSettings));
        await mlAdapter.putEvent('agent/actions/settings/', `voice_tune_${Date.now()}`, { key, value });
        return { ok: true };
      },
      setGraphics: async (patch: Partial<GraphicsSettings>) => {
        setGraphics(prev => ({ ...prev, ...patch } as GraphicsSettings));
        await mlAdapter.putEvent('agent/actions/settings/', `gfx_${Date.now()}`, { patch });
        return { ok: true };
      },
    });

    return () => AGENT_CONTROL.unregister('SystemSettings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedVoices, selectedVoice]);

  // Handle Animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleSave = () => {
    setIsSaving(true);
    
    // Save to LocalStorage
    localStorage.setItem('agent_lee_graphics', JSON.stringify(graphics));

    // Simulate network delay for effect
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    const defaultGraphics = {
      bloomStrength: 1.5,
      particleCount: 20000,
      hue: 180,
      resolutionScale: 1.0,
      chromaticAberration: true
    };
    
    setGraphics(defaultGraphics);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'AUDIO':
        return <NeuralVoiceTuner className="animate-in fade-in slide-in-from-bottom-4 duration-500" />;
      
      case 'VISUALS':
        return (
          <VisualsTuner 
            settings={graphics} 
            onSettingsChange={setGraphics}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500" 
           />
        );
      
      default: return null;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center md:p-8 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop (Visible on desktop) */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md hidden md:block" 
        onClick={onClose}
      />
      
      {/* Modal Container (Full screen on mobile, floating on desktop) */}
      <div className={`relative w-full h-full md:h-[90vh] md:max-w-7xl bg-[#050505] md:border border-gray-800 md:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row transform transition-transform duration-300 ${isOpen ? 'scale-100' : 'scale-95'}`}>
        
        {/* Navigation (Sidebar on Desktop, Tab Bar on Mobile) */}
        <div className="w-full md:w-64 bg-[#08080a] border-b md:border-b-0 md:border-r border-gray-800 p-4 md:p-6 flex flex-row md:flex-col justify-between md:justify-start gap-4 shrink-0">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-[#00ffff] rounded flex items-center justify-center shrink-0">
                <Terminal size={16} className="text-black" />
             </div>
             <span className="font-mono font-bold text-white tracking-wider hidden md:inline">CONFIG_V1</span>
           </div>

           <nav className="flex flex-row md:flex-col gap-2 flex-1 md:flex-none overflow-x-auto md:overflow-visible">
              {[
                { id: 'AUDIO', icon: Volume2, label: 'VOICE' },
                { id: 'VISUALS', icon: Monitor, label: 'VISUALS' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 md:gap-3 p-2 md:p-3 rounded-lg font-mono text-xs md:text-sm transition-all duration-200 whitespace-nowrap ${activeTab === item.id ? 'bg-[#00ffff]/10 text-[#00ffff] border border-[#00ffff]/20 shadow-[0_0_10px_rgba(0,255,255,0.1)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                   <item.icon size={16} className="shrink-0" />
                   <span className="md:inline">{item.label}</span>
                </button>
              ))}
           </nav>

           <div className="hidden md:block pt-6 border-t border-gray-800">
              <div className="text-[10px] text-gray-600 font-mono mb-2">SESSION ID: 0X9928A</div>
              <div className="flex items-center gap-2 text-[10px] text-green-500 font-mono">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                 SYSTEM ONLINE
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900/20 via-[#050505] to-[#050505]">
           {/* Header */}
           <div className="h-14 md:h-16 border-b border-gray-800 flex items-center justify-center md:justify-between px-4 md:px-8 bg-[#050505]/95 backdrop-blur-sm sticky top-0 z-20">
              <h2 className="text-white font-mono text-xs md:text-sm tracking-[0.2em] flex items-center gap-2 truncate">
                 <span className="text-[#00ffff]">/</span> SETTINGS <span className="text-gray-600">/</span> {activeTab}
              </h2>
              <button 
                onClick={onClose}
                aria-label="Close settings"
                title="Close settings"
                className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-white transition-colors"
              >
                <X size={16} />
              </button>
           </div>

           {/* Scrollable Content */}
           <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
              {renderTabContent()}
           </div>

           {/* Footer Action Bar */}
           <div className="h-auto md:h-20 border-t border-gray-800 p-4 md:px-8 flex flex-col md:flex-row items-center justify-end gap-3 bg-[#050505] shrink-0">
              <button 
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-gray-400 hover:text-white font-mono text-xs transition-colors order-2 md:order-1"
                onClick={handleReset}
              >
                 <RotateCcw size={14} /> RESET DEFAULTS
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-mono text-xs font-bold transition-all duration-300 order-1 md:order-2 ${isSaving ? 'bg-[#00ffff] text-black md:w-48 cursor-wait' : 'bg-[#0044ff] hover:bg-[#0033dd] text-white shadow-[0_0_20px_rgba(0,68,255,0.3)]'}`}
              >
                 {isSaving ? (
                    <>PROCESSING<span className="animate-pulse">...</span></>
                 ) : (
                    <><Save size={14} /> SAVE CONFIGURATION</>
                 )}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};

/* ==================================================================================
 * 7. MAIN APP COMPONENT (LANDING & ENTRY)
 * ================================================================================== */

const SystemConfig = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-black pointer-events-none">
        {/* Grid Floor */}
              <div className="absolute inset-0 opacity-20 grid-floor"></div>
        
        {/* Central Core Glow */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px]"></div>
      </div>

      {/* Main Entry Button Container */}
      <div className="relative z-10 flex flex-col items-center gap-6 md:gap-10 animate-in fade-in zoom-in duration-1000 px-4">
         {/* Branding */}
         <div className="text-center">
             <h1 className="text-white font-mono font-bold text-3xl md:text-5xl tracking-[0.2em] drop-shadow-[0_0_25px_rgba(0,255,255,0.4)] mb-3 break-words">
                 AGENT LEE
             </h1>
             <p className="text-[#00ffff] font-mono text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.5em] uppercase opacity-70">Sovereign Neural Monolith v30.0</p>
         </div>

         {/* The Button */}
         <button 
           onClick={() => setIsSettingsOpen(true)}
           className="group relative flex items-center gap-4 md:gap-6 px-8 md:px-16 py-6 md:py-8 bg-[#0a0a0f] border border-gray-800 hover:border-cyan-500 rounded-2xl text-gray-400 hover:text-cyan-400 transition-all duration-500 hover:shadow-[0_0_50px_rgba(0,255,255,0.15)] hover:-translate-y-1 w-full max-w-sm md:max-w-none"
         >
            <div className="relative shrink-0">
              <Settings className="w-8 h-8 md:w-10 md:h-10 group-hover:rotate-180 transition-transform duration-1000 ease-in-out" />
              <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
            </div>
            
            <div className="text-left min-w-0">
                <span className="block font-mono text-[9px] md:text-[10px] text-gray-600 group-hover:text-cyan-600 transition-colors tracking-widest uppercase mb-1 truncate">Access Terminal</span>
                <span className="block font-mono text-lg md:text-2xl font-bold tracking-widest text-white group-hover:text-cyan-100 transition-colors truncate">SYSTEM CONFIG</span>
            </div>
            
            {/* Cyberpunk Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-gray-700 group-hover:border-cyan-500 transition-colors duration-300"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-gray-700 group-hover:border-cyan-500 transition-colors duration-300"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-gray-700 group-hover:border-cyan-500 transition-colors duration-300 opacity-0 group-hover:opacity-100"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-gray-700 group-hover:border-cyan-500 transition-colors duration-300 opacity-0 group-hover:opacity-100"></div>
         </button>
      </div>

      {/* Footer Text */}
      <div className="absolute bottom-8 text-[9px] md:text-[10px] text-gray-800 font-mono tracking-widest text-center px-4">
         SECURE CONNECTION ESTABLISHED // LOCALHOST
      </div>

      {/* Modal Overlay */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onOpen={() => setIsSettingsOpen(true)}
      />
    </div>
  );
};

export { SettingsModal };
export default SystemConfig;
