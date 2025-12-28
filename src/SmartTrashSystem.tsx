import { GoogleGenAI, Type } from "@google/genai";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { globalTrashService } from './services/GlobalTrashService';

// --- INTERNAL TYPES ---
export enum FileType {
  DOC = 'document',
  CODE = 'code',
  IMAGE = 'image',
  DATA = 'data',
  OTHER = 'other'
}

export interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  size: number;
  deletedAt: number;
  type: FileType;
  contentSnippet?: string;
  importanceScore: number;
  aiReason: string;
  verdict: 'Safe to Delete' | 'Review First' | 'Keep for Now';
  category?: string;
  payload?: any;
}

export interface AgentLeeRef {
  speak: (intensity?: number) => void;
  stop: () => void;
}

// --- GENAI SERVICE ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const analyzeTrashItem = async (item: Partial<TrashItem>): Promise<{ score: number; reason: string; verdict: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Agent Lee, a friendly AI in the Trash Engine. Use simple English for a 13-year-old.
      Analyze this deleted file:
      Name: ${item.name}
      Type: ${item.type}
      Path: ${item.originalPath}
      Snippet: ${item.contentSnippet || "N/A"}
      
      Output JSON:
      - score: 0.0 to 1.0 (importance)
      - reason: one simple sentence explaining what it is.
      - verdict: "Safe to Delete", "Review First", or "Keep for Now"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            reason: { type: Type.STRING },
            verdict: { type: Type.STRING }
          },
          required: ["score", "reason", "verdict"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return { score: 0.1, reason: "Looks like typical computer junk.", verdict: "Safe to Delete" };
  }
};

// --- 3D AGENT LEE VORTEX CORE ---
const AgentLeeVortex = forwardRef<AgentLeeRef>((_, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef(false);
  const intensityRef = useRef(0);

  useImperativeHandle(ref, () => ({
    speak: (intensity = 1) => { 
      isSpeakingRef.current = true; 
      intensityRef.current = intensity; 
    },
    stop: () => { 
      isSpeakingRef.current = false; 
      intensityRef.current = 0; 
    }
  }));

  useEffect(() => {
    if (!mountRef.current) return;

    let frame: number;
    let renderer: THREE.WebGLRenderer;
    let composer: any;
    
    const init = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.set(0, 4, 12);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      mountRef.current.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableZoom = true;
      controls.minDistance = 4;
      controls.maxDistance = 25;

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height), 
        1.0, // Initial strength
        0.5, 
        0.8 
      );
      composer.addPass(bloom);

      // --- THE VORTEX: DENSE CORE + RADIATING SHELL ---
      const count = 12000;
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        emissive: 0x00ffff, 
        emissiveIntensity: 1.0 
      });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      scene.add(mesh);

      const dummy = new THREE.Object3D();
      const colors = new Float32Array(count * 3);
      const colorArr = new THREE.Color();
      
      for (let i = 0; i < count; i++) {
        // Two tiers: Inner Core (30%) and Outer Particle Cloud (70%)
        const isCore = i < count * 0.25;
        const r = isCore 
          ? (Math.random() * 2.0) 
          : (2.8 + Math.pow(Math.random(), 2.0) * 6.5);

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(isCore ? (Math.random() * 0.6 + 0.3) : (Math.random() * 0.25 + 0.1));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Color coding
        if (isCore) {
          colorArr.setHex(0xffffff); // Bright Core
        } else {
          const depth = (r - 2.8) / 6.5;
          colorArr.setHex(depth > 0.6 ? 0x0044ff : 0x00ffff); 
        }
        colorArr.toArray(colors, i * 3);
      }
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

      scene.add(new THREE.AmbientLight(0xffffff, 0.1));
      const coreLight = new THREE.PointLight(0x00ffff, 10, 20);
      scene.add(coreLight);

      const animate = () => {
        frame = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;
        controls.update();

        const speaking = isSpeakingRef.current ? intensityRef.current : 0;
        
        // Particle mesh movement
        mesh.rotation.y += 0.001 + (speaking * 0.05);
        mesh.rotation.x += 0.0002;

        const pulse = 1.0 + Math.sin(time * 2.0) * 0.02 + (speaking * 0.15);
        mesh.scale.setScalar(pulse);

        // Dynamic Lighting
        coreLight.intensity = 10 + (speaking * 40);
        bloom.strength = 1.0 + (speaking * 2.2);

        composer.render();
      };
      animate();
    };

    const timer = setTimeout(init, 50);

    const handleResize = () => {
      if (!mountRef.current || !renderer || !composer) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frame);
      renderer?.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-move" />;
});

// --- SMART TRASH SYSTEM MAIN ---
const INITIAL_TRASH: Partial<TrashItem>[] = [
  { name: 'Essay_FrenchRev_v1.docx', type: FileType.DOC, originalPath: '/Desktop/History', size: 34000, contentSnippet: "The French Revolution (1789–1799) was a period of..." },
  { name: 'Minecraft_World_Backup.zip', type: FileType.DATA, originalPath: '/Saves/Minecraft', size: 45000000, contentSnippet: "[Compressed World Data Stream]" }
];

interface SmartTrashSystemProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const SmartTrashSystem: React.FC<SmartTrashSystemProps> = ({ isOpen: propIsOpen, onClose }) => {
  const [isOpen, setIsOpen] = useState(propIsOpen || false);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [chat, setChat] = useState<{r: 'l'|'u', t: string}[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [viewing, setViewing] = useState<TrashItem | null>(null);
  const lee = useRef<AgentLeeRef>(null);

  // Debug prop changes
  useEffect(() => {
    console.log('[SmartTrashSystem] propIsOpen changed:', propIsOpen);
  }, [propIsOpen]);

  useEffect(() => {
    console.log('[SmartTrashSystem] isOpen changed:', isOpen);
  }, [isOpen]);

  const totalSize = useMemo(() => items.reduce((a, b) => a + b.size, 0), [items]);
  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`;

  // Subscribe to global trash service
  useEffect(() => {
    const unsubscribe = globalTrashService.subscribe((trashItems) => {
      setItems(trashItems);
    });
    
    return unsubscribe;
  }, []);

  // Sync with props
  useEffect(() => {
    setIsOpen(propIsOpen || false);
  }, [propIsOpen]);

  // Expose methods to parent components
  useEffect(() => {
    // Make this component available globally
    (window as any).openTrashSystem = () => setIsOpen(true);
    (window as any).closeTrashSystem = () => {
      setIsOpen(false);
      onClose?.();
    };
  }, [onClose]);

  const speakMessage = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    setChat(prev => [{ r: 'l', t: text }, ...prev]);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onstart = () => lee.current?.speak(1.0);
    utterance.onend = () => lee.current?.stop();
    utterance.onerror = () => lee.current?.stop();
    window.speechSynthesis.speak(utterance);
  }, []);

  const processFile = async (f: Partial<TrashItem>) => {
    setThinking(true);
    const { score, reason, verdict } = await analyzeTrashItem(f);
    const item = globalTrashService.addItem({
      name: f.name!, type: f.type!, originalPath: f.originalPath!, size: f.size!,
      contentSnippet: f.contentSnippet || "No internal preview available.",
      importanceScore: score, aiReason: reason, verdict: verdict as any
    });
    setThinking(false);
    if (isOpen) speakMessage(`Found ${f.name}. ${reason}`);
    return item;
  };

  // Initialize with some items if empty
  useEffect(() => {
    if (items.length === 0 && isOpen) {
      INITIAL_TRASH.forEach(f => processFile(f));
    }
  }, [isOpen, items.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input; setInput('');
    setChat(p => [{r: 'u', t: q}, ...p]);
    setThinking(true);
    
    try {
      const res = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are Agent Lee. You live in the Trash Engine. Help the user with these files: ${items.map(i => i.name).join(', ')}. User says: ${q}. Use cool teenager-friendly slang but be very helpful.` 
      });
      setThinking(false);
      speakMessage(res.text || "I'm ready! What else is on your mind?");
    } catch (err) {
      setThinking(false);
      speakMessage("Neural circuits are a bit fuzzy, but I'm still scanning the trash!");
    }
  };

  if (!isOpen) {
    return null; // Don't render anything when closed
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans overflow-hidden text-white select-none">
      
      {/* HEADER SECTION: VORTEX & CHAT INPUT */}
      <div className="flex-none bg-zinc-950 border-b border-white/5 shadow-2xl z-50">
          <div className="p-3 flex justify-between items-center max-w-xl mx-auto">
          <h1 className="text-xs font-black italic tracking-tighter uppercase">
            Trash <span className="text-cyan-500">Engine</span>
          </h1>
          <button title="Close Trash Engine" aria-label="Close Trash Engine" onClick={() => { setIsOpen(false); onClose?.(); }} className="text-white/20 hover:text-white p-2">
            <i className="fa-solid fa-chevron-down"></i>
          </button>
        </div>

        <div className="p-4 max-w-xl mx-auto flex flex-col gap-4">
          <div className="flex gap-4 h-64 md:h-80">
            {/* AGENT LEE VORTEX CORE */}
            <div className="flex-1 h-full rounded-[3rem] bg-black border border-cyan-500/20 overflow-hidden relative shadow-inner">
              <AgentLeeVortex ref={lee} />
              <div className="absolute top-4 left-6 pointer-events-none">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500/30">Vortex Live // zoom enabled</span>
                </div>
              </div>
            </div>
            
            {/* CHAT LOG DISPLAY */}
            <div className="w-1/3 h-full bg-white/5 border border-white/10 rounded-[3rem] p-5 overflow-y-auto custom-scrollbar relative text-[10px] leading-relaxed">
              {chat.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center opacity-10">
                  <i className="fa-solid fa-satellite text-2xl mb-2"></i>
                  <p className="font-black uppercase tracking-widest text-center">Awaiting Input</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chat.slice(0, 15).map((m, i) => (
                    <div key={i} className={`${m.r === 'l' ? 'text-cyan-300' : 'text-white/30 italic text-right'}`}>
                      {m.r === 'l' && <span className="font-black text-cyan-500 mr-1 text-[8px]">LEE:</span>}
                      {m.t}
                    </div>
                  ))}
                  {thinking && <div className="text-cyan-500 animate-pulse font-black uppercase tracking-widest text-[8px]">Scanning Neural Paths...</div>}
                </div>
              )}
            </div>
          </div>

          {/* TOP CHAT INPUT BOX */}
          <form onSubmit={handleSendMessage} className="relative group">
            <input 
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="Talk to Agent Lee..."
              className="w-full bg-black border border-white/10 rounded-[2.5rem] px-8 py-5 pr-20 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner"
            />
            <button type="submit" title="Send message" aria-label="Send message" className="absolute right-3 top-3 bottom-3 w-14 bg-cyan-500 rounded-2xl text-black flex items-center justify-center shadow-lg hover:bg-cyan-400 active:scale-90 transition-all">
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>
      </div>

      {/* DISCARDED FILES LIST AREA */}
      <div className="flex-1 overflow-y-auto bg-black p-4 custom-scrollbar">
        <div className="max-w-xl mx-auto pb-24 space-y-4">
          <div className="flex justify-between items-center px-4">
            <span className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em]">Discarded Memory</span>
            <button 
              disabled={items.length === 0}
              onClick={() => { globalTrashService.emptyTrash(); speakMessage("Trash Engine purged. Total disk space freed up!"); }}
              className="text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              <i className="fa-solid fa-bomb"></i> Empty All ({formatBytes(totalSize)})
            </button>
          </div>

          {items.map(item => (
            <div key={item.id} className="p-6 bg-zinc-900/40 border border-white/5 rounded-[3rem] hover:border-cyan-500/20 transition-all shadow-lg group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/5 flex items-center justify-center text-cyan-500 group-hover:bg-cyan-500/10 transition-colors">
                    <i className="fa-solid fa-file-shield text-xl"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white/90 truncate max-w-[180px]">{item.name}</h4>
                    <p className="text-[9px] text-white/20 uppercase font-black tracking-widest mt-1">{formatBytes(item.size)}</p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${
                  item.verdict === 'Safe to Delete' 
                    ? 'border-green-500/20 text-green-400 bg-green-500/5' 
                    : 'border-orange-500/20 text-orange-400 bg-orange-500/5'
                }`}>
                  {item.verdict}
                </div>
              </div>
              
              <div className="p-5 bg-white/5 rounded-2xl mb-6">
                <p className="text-[11px] text-cyan-100/60 leading-relaxed italic border-l-2 border-cyan-500/30 pl-4">
                  "{item.aiReason}"
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <button onClick={() => { setViewing(item); speakMessage(`Opening ${item.name} fragment.`); }} className="py-3 bg-white/5 rounded-2xl text-[9px] font-black uppercase text-white/40 hover:text-white transition-all border border-white/5">View</button>
                <button onClick={async () => { await globalTrashService.removeItem(item.id); speakMessage(`${item.name} has been restored!`); }} className="py-3 bg-cyan-500/10 rounded-2xl text-[9px] font-black uppercase text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all">Restore</button>
                <button onClick={async () => { globalTrashService.permanentlyDeleteItem(item.id); speakMessage("Shredding complete."); }} className="py-3 bg-red-600/10 rounded-2xl text-[9px] font-black uppercase text-red-500 hover:bg-red-600 hover:text-white transition-all">Destroy</button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="py-32 text-center flex flex-col items-center justify-center opacity-5">
              <i className="fa-solid fa-recycle text-8xl mb-6"></i>
              <p className="text-sm font-black uppercase tracking-[1em]">Engine Purged</p>
            </div>
          )}
        </div>
      </div>

      {/* OVERLAY: DETAILED FILE VIEWER */}
      {viewing && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col animate-in fade-in slide-in-from-bottom-12 duration-500">
          <div className="p-8 flex justify-between items-center border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{viewing.name}</h2>
              <div className="flex gap-4 mt-1">
                <span className="text-[10px] text-cyan-500 font-black uppercase tracking-widest">{viewing.type} Segment</span>
                <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">{formatBytes(viewing.size)}</span>
              </div>
            </div>
            <button title="Close viewer" aria-label="Close viewer" onClick={() => setViewing(null)} className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center text-white/20 hover:text-white transition-all border border-white/5">
              <i className="fa-solid fa-xmark text-2xl"></i>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="p-10 bg-cyan-500/5 rounded-[4rem] border border-cyan-500/10 relative shadow-2xl">
                <div className="absolute -top-4 left-12 px-6 py-2 bg-cyan-500 text-black text-[10px] font-black uppercase rounded-full shadow-lg">Lee's Neural Report</div>
                <p className="text-lg text-cyan-50/70 leading-relaxed italic font-medium">" {viewing.aiReason} "</p>
                <div className="mt-8 flex gap-8 items-center pt-8 border-t border-cyan-500/10">
                   <div className="text-[10px] font-black uppercase text-white/20">Significance: <span className="text-cyan-400">{(viewing.importanceScore * 100).toFixed(0)}%</span></div>
                   <div className="text-[10px] font-black uppercase text-white/20">Status: <span className="text-cyan-400">{viewing.verdict}</span></div>
                </div>
              </div>
              
              <div className="bg-zinc-950 rounded-[4rem] border border-white/5 overflow-hidden shadow-inner">
                <div className="bg-white/5 px-10 py-5 border-b border-white/5 text-[10px] font-mono text-white/10 uppercase tracking-[0.2em] flex justify-between items-center">
                  <span>Hex View Fragment</span>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40"></div>
                  </div>
                </div>
                <pre className="p-12 text-[13px] text-white/30 font-mono whitespace-pre-wrap leading-relaxed break-all select-text selection:bg-cyan-500 selection:text-black">
                  {viewing.contentSnippet}
                </pre>
              </div>
            </div>
          </div>

          <div className="p-10 border-t border-white/5 bg-zinc-950 grid grid-cols-2 gap-8 pb-20 shadow-[0_-30px_60px_rgba(0,0,0,0.8)]">
            <button 
              onClick={async () => { await globalTrashService.removeItem(viewing.id); setViewing(null); speakMessage("Restoring data segment!"); }} 
              className="py-6 bg-white/5 rounded-[2.5rem] text-cyan-400 font-black uppercase text-xs border border-white/5 shadow-lg active:scale-95 transition-all"
            >
              <i className="fa-solid fa-rotate-left mr-3"></i> Restore Segment
            </button>
            <button 
              onClick={() => { globalTrashService.permanentlyDeleteItem(viewing.id); setViewing(null); speakMessage("Segment deleted permanently."); }} 
              className="py-6 bg-red-600 rounded-[2.5rem] text-white font-black uppercase text-xs shadow-2xl active:scale-95 transition-all"
            >
              <i className="fa-solid fa-trash-can mr-3"></i> Purge From System
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartTrashSystem;
