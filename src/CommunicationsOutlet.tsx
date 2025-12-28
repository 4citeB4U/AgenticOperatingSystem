/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.COMMUNICATIONSOUTLET.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   CommunicationsOutlet.tsx
   
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

import { GoogleGenAI } from "@google/genai";
import { useEffect, useRef, useState } from 'react';
import './CommunicationsOutlet.css';
import { AGENT_CONTROL } from './coreRegistry';
import { mlAdapter } from './memoryLakeAdapter';
import { isAllowed } from './policyClient';
import { globalTrashService } from './services/GlobalTrashService';
import { FileType } from './SmartTrashSystem';

// ===================================================================================
//  CONFIG & SERVICES
// ===================================================================================

// No environment API keys are read in the client. Remote LLMs are disabled by default
// to enforce zero-egress and to avoid exposing secrets in the browser.
const REMOTE_LLM_ENABLED = isAllowed('REMOTE_LLM') === true;
if (REMOTE_LLM_ENABLED) {
    console.warn('[POLICY] REMOTE_LLM is allowed, but client keys are intentionally not loaded. Remote LLM remains disabled unless you provide a secure server-side proxy.');
}

// Zero-egress default: keep remote client null. Do NOT throw at module load.
const ai: GoogleGenAI | null = null;

// Helper to read the API key from Vite envs (if present)
function getGenAIKey(): string | null {
    const k = (import.meta as any)?.env?.VITE_GEMINI_API_KEY ||
        (import.meta as any)?.env?.VITE_GOOGLE_GENAI_API_KEY ||
        (import.meta as any)?.env?.VITE_GOOGLE_API_KEY;
    return typeof k === 'string' && k.trim() ? k.trim() : null;
}

const INITIAL_CONTACTS = [
  { id: 1, name: 'Sarah Miller', number: '(555) 123-4567', status: 'online', avatar: null },
  { id: 2, name: 'John Doe', number: '5559876543', status: 'offline', avatar: null }, 
  { id: 3, name: 'Logistics Team', number: '5555555555', status: 'busy', avatar: null },
];

const MOCK_RECENTS = [
    { id: 1, name: 'Mom', type: 'incoming', time: '10:30 AM', missed: false },
    { id: 2, name: '(555) 987-6543', type: 'outgoing', time: 'Yesterday', missed: false },
    { id: 3, name: 'Logistics Team', type: 'incoming', time: 'Yesterday', missed: true },
    { id: 4, name: 'Sarah Miller', type: 'outgoing', time: 'Monday', missed: false },
    { id: 5, name: 'Unknown', type: 'incoming', time: 'Sunday', missed: true },
    { id: 6, name: 'Office Main', type: 'outgoing', time: 'Saturday', missed: false },
    { id: 7, name: 'Delivery Service', type: 'incoming', time: 'Friday', missed: false },
    { id: 8, name: 'Spam Risk', type: 'incoming', time: 'Friday', missed: true },
];

const MOCK_MESSAGES = [
  { id: 1, sender: 'them', text: "Are we still on for the meeting?", time: "09:00 AM" },
  { id: 2, sender: 'me', text: "Yes, seeing you there.", time: "09:05 AM" },
];

const INITIAL_FILES = [
    { id: 1, type: 'image', name: 'Site_Photo_001.jpg', thumb: 'bg-blue-900', url: null },
    { id: 2, type: 'image', name: 'Site_Photo_002.jpg', thumb: 'bg-blue-800', url: null },
    { id: 3, type: 'video', name: 'Walkthrough.mp4', thumb: 'bg-purple-900', url: null },
    { id: 4, type: 'doc', name: 'Q3_Report.pdf', thumb: 'bg-slate-700', url: null },
    { id: 5, type: 'doc', name: 'Invoice_#1024.pdf', thumb: 'bg-slate-700', url: null },
];

// ===================================================================================
//  COMPONENTS
// ===================================================================================

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, title = '' }: any) => {
  const baseStyle = "px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 active:scale-95 transform transition-transform";
  const variants: any = {
    primary: "bg-blue-600 active:bg-blue-700 text-white shadow-lg shadow-blue-900/50",
    secondary: "bg-slate-700 active:bg-slate-600 text-slate-200",
    danger: "bg-red-600 active:bg-red-700 text-white",
    ghost: "bg-transparent active:bg-slate-800/50 text-slate-400",
    outline: "bg-transparent border border-slate-600 text-slate-300 active:bg-slate-800",
    disabled: "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50",
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
            title={title}
            aria-label={title || undefined}
      className={`${baseStyle} ${disabled ? variants.disabled : variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- HEX BUTTON COMPONENT ---
const HexButton = ({ children, onClick, color = 'slate', className = '', style = {}, ariaLabel = '' }: any) => {
    const hexClip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    
    const colorStyles: any = {
        slate: "bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-blue-900/50",
        blue: "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-900/50",
        green: "bg-green-600 text-white hover:bg-green-500 active:bg-green-700 shadow-lg shadow-green-900/40",
        red: "bg-slate-800 text-red-400 hover:bg-red-900/30 active:bg-red-900/50 border border-red-900/50",
        ghost: "bg-slate-900/50 text-slate-500 hover:bg-slate-800 border border-slate-800",
        active: "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]",
    };

    return (
        <button
            onClick={onClick}
            aria-label={ariaLabel || undefined}
            className={`relative flex items-center justify-center transition-all duration-200 active:scale-90 hex-button ${className}`}
        >
            <div className={`absolute inset-0.5 ${colorStyles[color]} flex flex-col items-center justify-center hex-inner`}>
                {children}
            </div>
             <div className={`absolute inset-0 -z-10 ${color === 'green' ? 'bg-green-400/30' : color === 'red' ? 'bg-red-400/20' : 'bg-slate-600/30'}`}></div>
        </button>
    );
};


// --- PERMISSIONS PAGE ---

const REQUIRED_PERMISSIONS = [
  {
    id: 'core',
    title: 'Default Handler',
    description: 'Set as default Phone & SMS app to manage calls and screen spam.',
    icon: 'fas fa-shield-alt'
  },
  {
    id: 'contacts',
    title: 'Identity & Contacts',
    description: 'Read and write access to sync your address book.',
    icon: 'fas fa-address-book'
  },
  {
    id: 'media',
    title: 'Media Access',
    description: 'Microphone and Camera access for FaceTime and Voice Messages.',
    icon: 'fas fa-video'
  }
];

const PermissionSwitch = ({ onEnable }: { onEnable: () => void }) => {
  const [active, setActive] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleToggle = async () => {
    if (active) return;
    setProcessing(true);
    
    try {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch(e) { console.log("Media permission skipped or denied for demo"); }
        
        await new Promise(r => setTimeout(r, 1500)); 
        
        setActive(true);
        setTimeout(onEnable, 800);
    } catch(e) {
        console.error(e);
        setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md animate-in slide-in-from-bottom duration-500">
       <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-3xl p-6 w-full shadow-2xl mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
             <i className="fas fa-lock text-blue-500"></i> System Permissions
          </h2>
          
          <div className="space-y-6 mb-8">
             {REQUIRED_PERMISSIONS.map(p => (
                 <div key={p.id} className="flex gap-4 items-start">
                     <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-700">
                         <i className={p.icon}></i>
                     </div>
                     <div>
                         <div className="text-white font-medium text-sm">{p.title}</div>
                         <div className="text-slate-500 text-xs leading-relaxed">{p.description}</div>
                     </div>
                 </div>
             ))}
          </div>

          <div className="border-t border-slate-800 pt-6">
              <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-300">Grant All Permissions</span>
                  <button 
                     onClick={handleToggle}
                     disabled={active || processing}
                     className={`w-16 h-9 rounded-full p-1 transition-all duration-300 ease-in-out relative ${active ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`}
                            aria-label={active || processing ? 'Permissions granted' : 'Grant all permissions'}
                  >
                      <div className={`w-7 h-7 bg-white rounded-full shadow-md transform transition-transform duration-300 ${active ? 'translate-x-7' : 'translate-x-0'}`}>
                         {processing && !active && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <i className="fas fa-spinner fa-spin text-slate-400 text-xs"></i>
                            </div>
                         )}
                      </div>
                  </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-4 text-center">
                  By enabling, you set Communications Outlet as your default handler for Calls and SMS.
              </p>
          </div>
       </div>
    </div>
  );
};

// --- QUICK NOTES MODAL ---

const QuickNotesModal = ({ isOpen, onClose, notes, addNote, onDelete }: any) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (input.trim()) {
      addNote(input);
      setInput('');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full sm:w-[90%] sm:rounded-2xl rounded-t-2xl border-t sm:border border-slate-700 max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <i className="fas fa-sticky-note text-yellow-500"></i> Quick Notes
          </h2>
                    <button onClick={onClose} aria-label="Close Quick Notes" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] custom-scrollbar">
          {notes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
              <i className="fas fa-pencil-alt text-2xl mb-2 opacity-50"></i>
              <p>No notes yet.</p>
            </div>
          )}
          {notes.map((note: string, idx: number) => (
            <div key={idx} className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-sm text-slate-200 relative group flex justify-between items-start gap-2 animate-in fade-in zoom-in-95">
              <span className="flex-1 whitespace-pre-wrap">{note}</span>
                            <button onClick={() => onDelete(idx)} aria-label={`Delete note ${idx + 1}`} className="text-slate-500 hover:text-red-400 px-2 py-1">
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700 pb-8 sm:pb-4 rounded-b-2xl">
          <div className="flex gap-2">
                        <button 
                            onClick={toggleListening}
                            aria-label={isListening ? 'Stop dictation' : 'Start dictation'}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-600 animate-pulse text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                            title={isListening ? "Stop Dictating" : "Dictate Note"}
                        >
              <i className={`fas fa-${isListening ? 'stop' : 'microphone'}`}></i>
            </button>
                        <input 
                            aria-label="Quick notes input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder={isListening ? "Listening..." : "Type to remember..."}
                            className={`flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all ${isListening ? 'ring-2 ring-red-500/50' : ''}`}
                            autoFocus
                        />
                        <Button title="Add note" onClick={handleAdd} className="rounded-xl w-12" disabled={!input.trim()}><i className="fas fa-plus"></i></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ADD CONTACT MODAL ---
const AddContactModal = ({ isOpen, onClose, initialNumber, onSave }: any) => {
    const [name, setName] = useState('');
    const [number, setNumber] = useState(initialNumber || '');
    const [avatar, setAvatar] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { 
        if(isOpen) {
            setNumber(initialNumber || ''); 
            setName('');
            setAvatar(null);
        }
    }, [isOpen, initialNumber]);

    if (!isOpen) return null;

    const handleFile = (e: any) => {
        if(e.target.files?.[0]) {
            setAvatar(URL.createObjectURL(e.target.files[0]));
        }
    }

    const handleSave = () => {
        if(name && number) {
            onSave({ name, number, avatar });
            onClose();
        }
    }

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4">
                <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Create New Contact</h2>
                    <button onClick={onClose} aria-label="Close Create Contact" className="text-slate-400 hover:text-white"><i className="fas fa-times"></i></button>
                </div>

                <div className="p-6 flex flex-col items-center gap-6">
                        <div className="relative group">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            aria-label="Add contact photo"
                            className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden group-hover:border-blue-500 transition-colors"
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                        >
                            {avatar ? (
                                <img src={avatar} alt={name || 'Contact avatar'} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center">
                                    <i className="fas fa-camera text-2xl text-slate-500 mb-1"></i>
                                    <div className="text-[9px] text-slate-500 uppercase font-bold">Add Photo</div>
                                </div>
                            )}
                        </div>
                        <input aria-label="Upload contact photo" id="contact-avatar" type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*" />
                    </div>

                    <div className="w-full space-y-3">
                        <div>
                            <label htmlFor="contact-name" className="text-xs text-slate-500 font-bold uppercase ml-1">Name</label>
                            <input 
                                id="contact-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Enter Name"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label htmlFor="contact-number" className="text-xs text-slate-500 font-bold uppercase ml-1">Number</label>
                            <input 
                                id="contact-number"
                                value={number}
                                onChange={e => setNumber(e.target.value)}
                                placeholder="(555) 000-0000"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-3 mt-2">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave} disabled={!name || !number}>Save Contact</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- VIDEO CALL DIALER MODAL ---

const VideoCallModal = ({ isOpen, onClose, contacts, onCall }: any) => {
    const [mode, setMode] = useState<'contacts' | 'keypad'>('contacts');
    const [dialString, setDialString] = useState('');

    if (!isOpen) return null;

    const handleDigit = (d: string) => setDialString(prev => prev + d);

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
             <div className="bg-slate-900 w-full sm:w-[90%] sm:max-w-md sm:rounded-2xl rounded-t-2xl border-t sm:border border-slate-700 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                 <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <i className="fas fa-user-plus text-blue-500"></i> Add Participant
                    </h2>
                    <button onClick={onClose} aria-label="Close Add Participant" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <i className="fas fa-times"></i>
                    </button>
                 </div>

                 <div className="flex p-2 gap-2 bg-slate-900">
                     <button 
                        onClick={() => setMode('contacts')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'contacts' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                     >Contacts</button>
                     <button 
                        onClick={() => setMode('keypad')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'keypad' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                     >Keypad</button>
                 </div>

                 <div className="flex-1 overflow-y-auto min-h-[300px] p-2 custom-scrollbar">
                     {mode === 'contacts' ? (
                         <div className="space-y-2">
                             {contacts.map((c: any) => (
                                 <button 
                                    key={c.id}
                                    onClick={() => { onCall(c); onClose(); }}
                                    className="w-full bg-slate-800 p-3 rounded-xl flex items-center gap-3 hover:bg-slate-700 transition-colors text-left"
                                 >
                                     <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold overflow-hidden border border-slate-600">
                                                     {c.avatar ? <img src={c.avatar} alt={c.name} className="w-full h-full object-cover"/> : c.name.charAt(0)}
                                     </div>
                                     <div>
                                         <div className="text-white font-bold text-sm">{c.name}</div>
                                         <div className="text-slate-500 text-xs">{c.number}</div>
                                     </div>
                                     <div className="ml-auto w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                                         <i className="fas fa-video"></i>
                                     </div>
                                 </button>
                             ))}
                         </div>
                     ) : (
                         <div className="flex flex-col items-center pt-4">
                             <div className="text-3xl text-white font-mono tracking-widest mb-6 min-h-[40px] border-b border-slate-800 w-full text-center pb-2">
                                 {dialString || <span className="text-slate-800">...</span>}
                             </div>
                             
                             <div className="grid grid-cols-3 gap-4 mb-6">
                                {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map((d) => (
                                    <button 
                                        key={d}
                                        onClick={() => handleDigit(d.toString())}
                                        className="w-16 h-16 rounded-full bg-slate-800 text-white text-2xl font-medium hover:bg-slate-700 active:bg-blue-600 transition-colors"
                                    >
                                        {d}
                                    </button>
                                ))}
                             </div>

                             <div className="flex gap-4 pb-8">
                                <button 
                                    onClick={() => setDialString(prev => prev.slice(0,-1))}
                                    aria-label="Backspace"
                                    className="w-16 h-16 rounded-full bg-slate-800 text-red-400 text-xl flex items-center justify-center"
                                >
                                    <i className="fas fa-backspace"></i>
                                </button>
                                <button 
                                    onClick={() => { 
                                        if(dialString) {
                                            onCall({ id: Date.now(), name: dialString, number: dialString, avatar: null }); 
                                            onClose(); 
                                        }
                                    }}
                                    aria-label="Call"
                                    className="w-16 h-16 rounded-full bg-green-600 text-white text-2xl flex items-center justify-center shadow-lg shadow-green-900/50"
                                >
                                    <i className="fas fa-phone"></i>
                                </button>
                             </div>
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
};


// --- CONTACTS MODAL ---

const ContactsModal = ({ isOpen, onClose, contacts, onAction, onAddContact, onDeleteContact }: any) => {
    const [selectedContact, setSelectedContact] = useState<number | null>(null);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-900 w-full sm:w-[90%] sm:rounded-2xl rounded-t-2xl border-t sm:border border-slate-700 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fas fa-address-book text-blue-500"></i> Contacts
              </h2>
                            <button onClick={onClose} aria-label="Close Contacts" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                <i className="fas fa-times"></i>
                            </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[400px] custom-scrollbar">
                {contacts.map((contact: any) => {
                    const isSelected = selectedContact === contact.id;
                    return (
                        <div key={contact.id} className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-blue-500/50' : ''}`}>
                             <div 
                                onClick={() => setSelectedContact(isSelected ? null : contact.id)}
                                className="p-3 flex items-center gap-4 cursor-pointer hover:bg-slate-700/50"
                             >
                                 <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold relative shrink-0 overflow-hidden">
                                    {contact.avatar ? (
                                        <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            {contact.name.charAt(0)}
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
                                            contact.status === 'online' ? 'bg-green-500' : 
                                            contact.status === 'busy' ? 'bg-red-500' : 'bg-slate-500'
                                            }`}></div>
                                        </>
                                    )}
                                 </div>
                                 <div className="flex-1">
                                     <div className="text-sm font-bold text-white">{contact.name}</div>
                                     <div className="text-xs text-slate-400">{contact.number}</div>
                                 </div>
                                 <i className={`fas fa-chevron-down text-slate-500 transition-transform ${isSelected ? 'rotate-180' : ''}`}></i>
                             </div>
                             
                             <div className={`grid grid-cols-5 gap-1 px-2 bg-slate-950/50 transition-all duration-300 ease-in-out ${isSelected ? 'max-h-20 py-2 border-t border-slate-700' : 'max-h-0 py-0 opacity-0 overflow-hidden'}`}>
                                 <button onClick={() => onAction('phone', contact)} className="flex flex-col items-center gap-1 py-1 hover:bg-slate-800 rounded-lg group">
                                     <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors"><i className="fas fa-phone"></i></div>
                                     <span className="text-[10px] text-slate-400">Call</span>
                                 </button>
                                 <button onClick={() => onAction('messages', contact)} className="flex flex-col items-center gap-1 py-1 hover:bg-slate-800 rounded-lg group">
                                     <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors"><i className="fas fa-comment-alt"></i></div>
                                     <span className="text-[10px] text-slate-400">Text</span>
                                 </button>
                                 <button onClick={() => onAction('video', contact)} className="flex flex-col items-center gap-1 py-1 hover:bg-slate-800 rounded-lg group">
                                     <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors"><i className="fas fa-video"></i></div>
                                     <span className="text-[10px] text-slate-400">Video</span>
                                 </button>
                                 <button onClick={() => onAction('voicemail', contact)} className="flex flex-col items-center gap-1 py-1 hover:bg-slate-800 rounded-lg group">
                                     <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors"><i className="fas fa-voicemail"></i></div>
                                     <span className="text-[10px] text-slate-400">Voice</span>
                                 </button>
                                 <button onClick={() => onDeleteContact?.(contact)} className="flex flex-col items-center gap-1 py-1 hover:bg-slate-800 rounded-lg group">
                                     <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors"><i className="fas fa-trash-alt"></i></div>
                                     <span className="text-[10px] text-slate-400">Delete</span>
                                 </button>
                             </div>
                        </div>
                    );
                })}
            </div>
            
             <div className="p-4 bg-slate-800 border-t border-slate-700 rounded-b-2xl">
                 <button 
                    onClick={onAddContact}
                    className="w-full py-3 bg-slate-900 border border-slate-700 rounded-xl text-blue-400 font-medium hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                     <i className="fas fa-plus"></i> Create New Contact
                 </button>
             </div>
          </div>
        </div>
    );
};

// --- DRAGGABLE PRESENTATION WINDOW ---

const DraggablePresentationWindow = ({ file, onClose }: any) => {
    const [pos, setPos] = useState({ x: 20, y: 80 });
    const [size, setSize] = useState({ w: 320, h: 240 });
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startVal = useRef({ x: 0, y: 0, w: 0, h: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const move = (e: MouseEvent) => {
            if (dragging) {
                setPos({
                    x: Math.max(0, startVal.current.x + (e.clientX - dragStart.current.x)),
                    y: Math.max(0, startVal.current.y + (e.clientY - dragStart.current.y))
                });
            }
            if (resizing) {
                setSize({
                    w: Math.max(200, startVal.current.w + (e.clientX - dragStart.current.x)),
                    h: Math.max(150, startVal.current.h + (e.clientY - dragStart.current.y))
                });
            }
        };
        const up = () => { setDragging(false); setResizing(false); };
        
        if (dragging || resizing) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [dragging, resizing]);

    useEffect(() => {
        if (rootRef.current) {
            rootRef.current.style.setProperty('--pos-left', `${pos.x}px`);
            rootRef.current.style.setProperty('--pos-top', `${pos.y}px`);
            rootRef.current.style.setProperty('--size-w', `${size.w}px`);
            rootRef.current.style.setProperty('--size-h', `${size.h}px`);
        }
    }, [pos, size]);

    return (
        <div 
            ref={rootRef}
            className="draggable-presentation-window absolute z-50 flex flex-col bg-slate-900 rounded-xl border border-slate-600 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden"
        >
             <div 
                className="h-8 bg-slate-800 flex items-center justify-between px-2 cursor-move border-b border-slate-700"
                onMouseDown={(e) => {
                    e.preventDefault();
                    setDragging(true);
                    dragStart.current = { x: e.clientX, y: e.clientY };
                    startVal.current = { x: pos.x, y: pos.y, w: 0, h: 0 };
                }}
             >
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    <i className="fas fa-broadcast-tower text-red-500 animate-pulse"></i> Presenting
                </div>
                     <button onClick={onClose} aria-label="Close presentation" className="text-slate-400 hover:text-white"><i className="fas fa-times"></i></button>
             </div>
             
             <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden group">
                     {file.url ? (
                     file.type === 'image' ? (
                         <img src={file.url} alt={file.name || file.type} className="w-full h-full object-contain pointer-events-none" />
                     ) : file.type === 'video' ? (
                         <video src={file.url} controls className="w-full h-full object-contain" />
                     ) : (
                         <div className="text-white flex flex-col items-center">
                            <i className="fas fa-file-alt text-4xl mb-2 text-slate-500"></i>
                            <span className="text-sm">{file.name}</span>
                         </div>
                     )
                 ) : (
                     <div className={`w-20 h-20 ${file.thumb} flex items-center justify-center text-white text-2xl rounded-xl`}>
                         <i className={`fas fa-${file.type === 'video' ? 'video' : 'file'}`}></i>
                     </div>
                 )}
                 
                 <div 
                    className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-10 flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setResizing(true);
                        dragStart.current = { x: e.clientX, y: e.clientY };
                        startVal.current = { ...pos, w: size.w, h: size.h };
                    }}
                 >
                     <div className="w-2 h-2 border-r-2 border-b-2 border-slate-400"></div>
                 </div>
             </div>
        </div>
    );
};

// --- TABS ---

const PhoneTab = ({ contacts, onAddContact }: { contacts: any[], onAddContact: (contact: any) => void }) => {
  const [display, setDisplay] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [viewMode, setViewMode] = useState<'recents' | 'keypad'>('keypad');
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  
  const [isAlphaMode, setIsAlphaMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const lastTapRef = useRef({ key: '', time: 0, index: 0 });

  const matchedContact = display.length > 2 
    ? contacts.find(c => display.replace(/\D/g, '').includes(c.number.replace(/\D/g, ''))) 
    : null;

  const handleDigit = (digit: string, letters: string) => {
    if (!isAlphaMode) {
        setDisplay(prev => prev + digit);
        return;
    }

    const now = Date.now();
    if (digit === '0') {
        setDisplay(prev => prev + ' ');
        lastTapRef.current = { key: '0', time: now, index: 0 };
        return;
    }

    const chars = letters ? letters.split('').concat([digit]) : [digit];
    
    if (digit === lastTapRef.current.key && (now - lastTapRef.current.time) < 1200) {
        const nextIndex = (lastTapRef.current.index + 1) % chars.length;
        setDisplay(prev => prev.slice(0, -1) + chars[nextIndex]);
        lastTapRef.current = { key: digit, time: now, index: nextIndex };
    } else {
        setDisplay(prev => prev + chars[0]);
        lastTapRef.current = { key: digit, time: now, index: 0 };
    }
  };
  
  const handleCall = () => {
    if (!display || display.length === 0) return;
    setCallStatus('calling');
    setTimeout(() => setCallStatus('connected'), 2000);
  };

  const handleEndCall = () => {
      setCallStatus('idle');
      setRecording(false);
      setMuted(false);
      setSpeaker(false);
  };

  const handleSaveContact = (newContact: any) => {
      onAddContact(newContact);
      setShowAddModal(false);
  };

  if (callStatus === 'connected' || callStatus === 'calling') {
    return (
      <div className="h-full flex flex-col items-center pt-8 px-6 animate-in slide-in-from-bottom duration-500 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="flex flex-col items-center mb-12">
            <div className="w-28 h-28 bg-slate-800 rounded-full flex items-center justify-center text-5xl text-slate-500 mb-6 shadow-2xl border-4 border-slate-800 relative overflow-hidden">
               {matchedContact?.avatar ? (
                   <img src={matchedContact.avatar} alt={matchedContact.name || 'caller'} className="w-full h-full object-cover" />
               ) : (
                   <i className="fas fa-user"></i>
               )}
               {callStatus === 'connected' && <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-slate-800"></div>}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{matchedContact?.name || display || "Unknown"}</h2>
            <p className="text-slate-400 font-medium">
                {callStatus === 'calling' ? 'Calling...' : '00:42'}
            </p>
        </div>
        
        <div className="w-full max-w-sm grid grid-cols-3 gap-y-8 gap-x-6 mb-12">
             {[
                 { id: 'mute', icon: muted ? 'fas fa-microphone-slash' : 'fas fa-microphone', label: 'Mute', active: muted, onClick: () => setMuted(!muted) },
                 { id: 'keypad', icon: 'fas fa-th', label: 'Keypad', active: false },
                 { id: 'speaker', icon: 'fas fa-volume-up', label: 'Speaker', active: speaker, onClick: () => setSpeaker(!speaker) },
                 { id: 'add', icon: 'fas fa-plus', label: 'Add Call', active: false },
                 { id: 'video', icon: 'fas fa-video', label: 'FaceTime', active: false },
                 { id: 'contacts', icon: 'fas fa-address-book', label: 'Contacts', active: false }
             ].map((btn, idx) => (
                 <button 
                    key={idx}
                    onClick={btn.onClick}
                    disabled={callStatus === 'calling'}
                    className={`flex flex-col items-center gap-2 group ${callStatus === 'calling' ? 'opacity-50' : ''}`}
                 >
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-200 ${btn.active ? 'bg-white text-slate-900' : 'bg-slate-800/50 text-white border border-slate-700'}`}>
                         <i className={btn.icon}></i>
                     </div>
                     <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">{btn.label}</span>
                 </button>
             ))}
        </div>

        <div className="w-full max-w-sm flex items-center justify-center gap-8 mt-auto mb-16">
            {callStatus === 'connected' && (
                <button 
                    onClick={() => setRecording(!recording)}
                    className={`flex flex-col items-center gap-2 ${recording ? 'text-red-500' : 'text-slate-500'}`}
                >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl border transition-all ${recording ? 'bg-red-500/10 border-red-500 animate-pulse' : 'bg-transparent border-slate-700'}`}>
                        <i className="fas fa-record-vinyl"></i>
                    </div>
                    <span className="text-xs font-medium">{recording ? 'Recording' : 'Record'}</span>
                </button>
            )}

            <button 
                onClick={handleEndCall}
                aria-label="End call"
                className="w-20 h-20 rounded-full bg-red-600 text-white text-3xl shadow-lg shadow-red-900/50 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center"
            >
                <i className="fas fa-phone-slash"></i>
            </button>
            
            {callStatus === 'connected' && <div className="w-14"></div>} 
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 relative overflow-hidden">
      
      <div className="shrink-0 p-4 border-b border-slate-800/50 flex justify-center bg-slate-950 z-30">
          <div className="bg-slate-900 p-1 rounded-full flex gap-1 border border-slate-800 w-full max-w-[240px]">
              <button 
                onClick={() => setViewMode('recents')}
                className={`flex-1 py-1.5 px-4 rounded-full text-xs font-bold transition-all duration-200 ${viewMode === 'recents' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  Recents
              </button>
              <button 
                onClick={() => setViewMode('keypad')}
                className={`flex-1 py-1.5 px-4 rounded-full text-xs font-bold transition-all duration-200 ${viewMode === 'keypad' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  Keypad
              </button>
          </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
          <div className={`absolute inset-0 flex flex-col transition-all duration-300 ${viewMode === 'recents' ? 'opacity-100 translate-y-0 z-10' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                 <div className="space-y-2 pb-4 pt-4">
                     {MOCK_RECENTS.map(call => (
                         <div key={call.id} onClick={() => { setDisplay(call.name.replace(/\D/g,'')); setViewMode('keypad'); }} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-900 active:bg-slate-800 transition-colors cursor-pointer group border border-transparent hover:border-slate-800">
                             <div className="flex items-center gap-3">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${call.missed ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                                     <i className={`fas fa-phone-${call.type === 'incoming' ? 'alt' : 'slash'} transform ${call.type === 'outgoing' ? '-rotate-45' : ''}`}></i>
                                 </div>
                                 <div>
                                     <div className={`font-medium ${call.missed ? 'text-red-400' : 'text-slate-200'}`}>{call.name}</div>
                                     <div className="text-xs text-slate-500">{call.time}</div>
                                 </div>
                             </div>
                             <button aria-label="Call details" className="text-slate-600 hover:text-blue-400 px-2"><i className="fas fa-info-circle text-lg"></i></button>
                         </div>
                     ))}
                 </div>
              </div>
          </div>

          <div className={`absolute inset-0 flex flex-col transition-all duration-300 ${viewMode === 'keypad' ? 'opacity-100 translate-y-0 z-10' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="pt-2 pb-1 px-6 flex flex-col items-center shrink-0">
                      <div className="h-4 text-blue-400 text-[10px] font-bold tracking-wide animate-in fade-in flex items-center gap-2">
                          {matchedContact ? (
                              <><i className="fas fa-check-circle"></i> {matchedContact.name}</>
                          ) : (
                              display.length > 0 ? "Unknown Number" : ""
                          )}
                      </div>

                      <div className="text-xl text-white font-mono tracking-widest text-center my-0.5 break-all w-full leading-tight min-h-[32px]">
                          {display || <span className="text-slate-800 text-xl">...</span>}
                      </div>

                      <div className="h-7 flex items-center justify-center w-full mt-0.5">
                          {display && !matchedContact && (
                               <button 
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-2 bg-slate-900 text-blue-400 px-3 py-1 rounded-full border border-slate-800 shadow-lg active:scale-95 transition-all hover:bg-slate-800 hover:border-slate-700 animate-in zoom-in-50 duration-200"
                                >
                                  <i className="fas fa-user-plus text-[9px]"></i>
                                  <span className="text-[9px] font-bold uppercase tracking-wider">Add Contact</span>
                               </button>
                          )}
                      </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center px-4 pb-4">
                      <div className="flex gap-3 items-stretch w-full max-w-[380px] p-2 bg-slate-900/40 rounded-3xl border border-slate-800 shadow-inner">
                          {/* Left Grid: Honeycomb Numbers */}
                          <div className="flex-1 grid grid-cols-3 gap-x-1.5 gap-y-0.5">
                              {/* Row 1 */}
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('1', '')} className="w-full">
                                <span className="text-xl font-black">1</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('2', 'ABC')} className="w-full">
                                <span className="text-xl font-black">2</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>ABC</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('3', 'DEF')} className="w-full">
                                <span className="text-xl font-black">3</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>DEF</span>
                              </HexButton>

                              {/* Row 2 */}
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('4', 'GHI')} className="w-full">
                                <span className="text-xl font-black">4</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>GHI</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('5', 'JKL')} className="w-full">
                                <span className="text-xl font-black">5</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>JKL</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('6', 'MNO')} className="w-full">
                                <span className="text-xl font-black">6</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>MNO</span>
                              </HexButton>

                              {/* Row 3 */}
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('7', 'PQRS')} className="w-full">
                                <span className="text-xl font-black">7</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>PQRS</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('8', 'TUV')} className="w-full">
                                <span className="text-xl font-black">8</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>TUV</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('9', 'WXYZ')} className="w-full">
                                <span className="text-xl font-black">9</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>WXYZ</span>
                              </HexButton>

                              {/* Row 4 */}
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('*', '')} className="w-full">
                                <span className="text-xl font-black">*</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('0', '+')} className="w-full">
                                <span className="text-xl font-black">0</span>
                                <span className={`text-[7px] font-bold tracking-[0.2em] mt-0.5 ${isAlphaMode ? 'text-blue-100' : 'text-slate-500'}`}>+</span>
                              </HexButton>
                              <HexButton color={isAlphaMode ? 'blue' : 'slate'} onClick={() => handleDigit('#', '')} className="w-full">
                                <span className="text-xl font-black">#</span>
                              </HexButton>
                          </div>

                          {/* Divider Line */}
                          <div className="w-[2px] bg-gradient-to-b from-transparent via-slate-800 to-transparent mx-1 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />

                          {/* Right Control Column - Extra Compact */}
                          <div className="w-[44px] flex flex-col gap-1.5 pt-1">
                              <HexButton 
                                  onClick={() => setIsAlphaMode(false)} 
                                  color={!isAlphaMode ? 'active' : 'slate'}
                                  className="w-full"
                              >
                                  <span className={`text-[7px] font-black tracking-tighter ${!isAlphaMode ? 'text-white' : 'text-slate-500'}`}>123</span>
                              </HexButton>
                              
                              <HexButton 
                                  onClick={() => setIsAlphaMode(true)} 
                                  color={isAlphaMode ? 'active' : 'slate'}
                                  className="w-full"
                              >
                                  <span className={`text-[7px] font-black tracking-tighter ${isAlphaMode ? 'text-white' : 'text-slate-500'}`}>ABC</span>
                              </HexButton>

                              <HexButton 
                                  color="red" 
                                  onClick={() => setDisplay(p => p.slice(0,-1))} 
                                  ariaLabel="Backspace"
                                  className={`w-full transition-all duration-300 ${display ? 'scale-100 opacity-100' : 'scale-75 opacity-50 pointer-events-none grayscale'}`}
                              >
                                  <i className="fas fa-backspace text-xs"></i>
                              </HexButton>

                              <HexButton 
                                  color="green" 
                                  onClick={handleCall} 
                                  ariaLabel="Call"
                                  className={`w-full transition-all duration-300 ${display ? 'scale-100 opacity-100' : 'scale-75 opacity-50 pointer-events-none grayscale'}`}
                              >
                                  <i className="fas fa-phone text-xs"></i>
                              </HexButton>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <AddContactModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        initialNumber={display}
        onSave={handleSaveContact}
      />
    </div>
  );
};

const MessagesTab = ({ onAskAI, files, onUpload }: { onAskAI: (prompt: string) => void, files: any[], onUpload: (e: any) => void }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>(MOCK_MESSAGES);
  const [drafting, setDrafting] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showMedia]);

    const handleSend = async (text: string = input, attachment?: any) => {
    if (!text.trim() && !attachment) return;
        const newMsg = { 
                id: Date.now().toString(), 
                sender: 'me', 
                text: text, 
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                media: attachment 
        };
        const updated = [...messages, newMsg];
        setMessages(updated);
    setInput('');
    setShowMedia(false);
        try {
            // Persist message into Memory Lake as a communications artifact
                        mlAdapter.putFile('communications/messages/', `message_${Date.now()}`, { sender: 'me', text, time: new Date().toISOString(), media: attachment });
                        // Also attempt to save the entire conversation into the current Drive/Slot as a conversation file
                        try {
                            const env = await AGENT_CONTROL.call('App', 'getCurrentDriveSlot');
                            const title = `comm-${env.selectedDrive || 'L'}-${env.selectedSlot || 1}-${Date.now()}`;
                            await AGENT_CONTROL.call('App', 'saveConversationFromComms', { title, messages: updated, existingId: null });
                        } catch (e) {
                            // best-effort, not fatal
                            console.warn('[CommunicationsOutlet] saveConversationFromComms failed', e);
                        }
        } catch (e) {
            console.warn('Failed to persist message to Memory Lake', e);
        }
  };

    // Register restore handler for messages
    useEffect(() => {
        try {
            globalTrashService.registerRestoreHandler('messages', async (item: any) => {
                if (!item || !item.payload) return false;
                const payload = item.payload as any;
                // reinstate message into UI and persist
                setMessages(prev => {
                    const nn = [...prev, payload.message];
                    (async () => {
                        try {
                            const env = await AGENT_CONTROL.call('App', 'getCurrentDriveSlot');
                            const title = `comm-restore-${env.selectedDrive || 'L'}-${env.selectedSlot || 1}-${Date.now()}`;
                            await AGENT_CONTROL.call('App', 'saveConversationFromComms', { title, messages: nn, existingId: null });
                        } catch (e) { console.warn('restore persist failed', e); }
                    })();
                    return nn;
                });
                return true;
            });
        } catch (e) {
            console.warn('Failed to register messages restore handler', e);
        }
    }, []);

    // NOTE: contact restore handler registered at CommunicationsOutlet level

  const handleDraft = async () => {
      setDrafting(true);
      try {
        if (!REMOTE_LLM_ENABLED || !ai) {
            console.warn('[POLICY] Remote LLM call blocked (REMOTE_LLM disabled or no client configured). Drafting skipped.');
            setDrafting(false);
            return;
        }

                // Hard re-type locally to avoid `ai` being inferred as never at this use-site.
                type GenAIClient = {
                    models: {
                        generateContent: (...args: any[]) => Promise<any>;
                    };
                };

                const client = (ai as unknown) as GenAIClient;

                if (!client?.models?.generateContent) {
                    console.error("AI client is not initialized or missing models.generateContent()");
                    setDrafting(false);
                    return;
                }

                const response = await client.models.generateContent({
                        model: 'gemini-3-flash-preview',
                        contents: `Draft a professional short reply to the last message: "${messages[messages.length-1].text}". Return only the message text.`
                });

        if (response.text) {
            setInput(response.text.trim());
        } else {
            console.error('Response text is undefined');
        }
      } catch (e) { console.error(e); }
      setDrafting(false);
  };

    useEffect(() => {
        AGENT_CONTROL.register('CommunicationsOutlet.Messages', {
            sendMessage: async ({ text }: { text: string }) => {
                handleSend(text || '');
                await mlAdapter.putEvent('agent/actions/comms/', `msg_send_${Date.now()}`, { textPreview: (text || '').slice(0, 120) });
                return { ok: true };
            },
            openAttachments: async () => {
                setShowMedia(true);
                await mlAdapter.putEvent('agent/actions/comms/', `msg_media_open_${Date.now()}`, {});
                return { ok: true };
            },
            closeAttachments: async () => {
                setShowMedia(false);
                await mlAdapter.putEvent('agent/actions/comms/', `msg_media_close_${Date.now()}`, {});
                return { ok: true };
            },
        });

        return () => AGENT_CONTROL.unregister('CommunicationsOutlet.Messages');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, showMedia, input]);

  const attachFile = (file: any) => {
      handleSend("", { type: file.type, url: file.url, name: file.name });
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}`}>
                            <p>{msg.text}</p>
              {msg.media && (
                  <div className="mt-2 rounded-lg overflow-hidden bg-black/20">
                     {msg.media.type === 'image' && <img src={msg.media.url} alt={msg.media.name || 'attachment'} className="max-w-full h-auto rounded-lg" />}
                     {msg.media.type === 'video' && <video src={msg.media.url} controls className="max-w-full h-auto rounded-lg" />}
                     {msg.media.type === 'audio' && (
                         <div className="flex items-center gap-2 p-2">
                             <i className="fas fa-music text-slate-400"></i>
                             <audio src={msg.media.url} controls className="w-full h-8" />
                         </div>
                     )}
                     <div className="text-[10px] text-slate-300 mt-1 px-1 truncate">{msg.media.name}</div>
                  </div>
              )}
              <span className={`text-[10px] mt-1 block text-right ${msg.sender === 'me' ? 'text-blue-200' : 'text-slate-500'}`}>{msg.time}</span>
                            <div className="flex gap-2 mt-1 justify-end">
                                <button aria-label="Delete message" title="Delete message" onClick={() => {
                                    // soft-delete into global trash
                                    try {
                                        globalTrashService.addItem({
                                                name: msg.text?.slice(0, 60) || 'Message',
                                                originalPath: 'communications/messages',
                                                size: 0,
                                                type: FileType.OTHER,
                                                category: 'messages',
                                                payload: { message: msg, index: idx }
                                            });
                                    } catch (e) { console.warn('Failed to add message to trash', e); }
                                    // remove locally
                                    setMessages(prev => prev.filter(m => m.id !== msg.id));
                                }} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
            </div>
          </div>
        ))}
        <div ref={endRef}></div>
      </div>

      <div className={`bg-slate-900 border-t border-slate-800 overflow-hidden transition-all duration-300 ease-in-out ${showMedia ? 'max-h-[220px]' : 'max-h-0'}`}>
          <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Recent Files</span>
                                    <button aria-label="Close recent files" onClick={() => setShowMedia(false)} className="text-slate-500"><i className="fas fa-times"></i></button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                                        aria-label="Upload file" 
                                        onChange={onUpload} 
                    className="hidden" 
                    accept="image/*,video/*,audio/*"
                  />
                  
                  {files.map(file => (
                      <button 
                         key={file.id} 
                         onClick={() => attachFile(file)}
                         aria-label={`Attach ${file.name}`}
                         className="shrink-0 w-24 flex flex-col gap-2 group"
                      >
                          {file.url ? (
                              file.type === 'image' ? (
                                  <img src={file.url} alt={file.name} className="w-24 h-24 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform" />
                              ) : (
                                  <div className={`w-24 h-24 rounded-xl bg-slate-800 flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-105 transition-transform border border-slate-700`}>
                                      <i className={`fas fa-${file.type === 'video' ? 'video' : file.type === 'audio' ? 'music' : 'file'}`}></i>
                                  </div>
                              )
                          ) : (
                              <div className={`w-24 h-24 rounded-xl ${file.thumb} flex items-center justify-center text-white text-3xl shadow-lg group-hover:scale-105 transition-transform`}>
                                  <i className={`fas fa-${file.type === 'image' ? 'image' : file.type === 'video' ? 'video' : 'file-alt'}`}></i>
                              </div>
                          )}
                          <span className="text-[10px] text-slate-400 truncate w-full text-center">{file.name}</span>
                      </button>
                  ))}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 w-24 h-24 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                      <i className="fas fa-plus text-xl mb-1"></i>
                      <span className="text-[10px]">Browse</span>
                  </button>
              </div>
          </div>
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 pb-safe z-10">
                    <div className="flex gap-2 items-center">
                    <button 
                         onClick={() => setShowMedia(!showMedia)}
                         aria-label={showMedia ? 'Close attachments' : 'Open attachments'}
                         className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showMedia ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        <i className="fas fa-paperclip"></i>
                    </button>

          <div className="flex-1 bg-slate-800 rounded-full border border-slate-700 flex items-center px-4 relative">
            <input 
                aria-label="Message input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Message..."
                className="flex-1 bg-transparent py-3 text-white focus:outline-none text-sm pr-8"
            />
            <button 
                onClick={handleDraft}
                disabled={drafting}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 flex items-center justify-center transition-colors"
                title="Draft with AI"
            >
                {drafting ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-wand-magic-sparkles text-xs"></i>}
            </button>
          </div>

             <button onClick={() => handleSend()} aria-label="Send message" className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                 <i className="fas fa-paper-plane text-sm"></i>
             </button>
        </div>
      </div>
    </div>
  );
};

const VideoTab = ({ files, onUpload, activeContact, contacts }: { files: any[], onUpload: (e: any) => void, activeContact: any, contacts: any[] }) => {
  const LOCAL_USER_ID = 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [error, setError] = useState<string>('');
  const [peers, setPeers] = useState<any[]>([]); 
  const [showMedia, setShowMedia] = useState(false);
  const [sharedFile, setSharedFile] = useState<any>(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  
  const [hostId, setHostId] = useState<number>(LOCAL_USER_ID);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isCameraOn) {
        if (videoRef.current) videoRef.current.srcObject = null;
        return;
      }

      try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false 
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        setError('');
      } catch (err) {
        console.error("Camera error:", err);
        setError("Camera unavailable");
      }
    };

    startCamera();

    return () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [facingMode, isCameraOn]);

  useEffect(() => {
      if (activeContact) {
          addPeer(activeContact);
      }
  }, [activeContact]);

  const addPeer = (contact: any) => {
      setPeers(prev => {
          if (prev.find(p => p.id === contact.id)) return prev;
          if (prev.length >= 3) {
              alert("Max 3 remote participants reached.");
              return prev;
          }
          
          const newPeer = { 
              ...contact, 
              status: 'calling',
              muted: false
          };
          
          setTimeout(() => {
              setPeers(current => current.map(p => p.id === contact.id ? { ...p, status: 'connected' } : p));
          }, 3500);

          return [...prev, newPeer];
      });
  };

  const removePeer = (id: number) => {
      setPeers(prev => prev.filter(p => p.id !== id));
      if (hostId === id) setHostId(LOCAL_USER_ID);
  };

  const toggleCameraFacing = () => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const toggleCameraOn = () => {
      setIsCameraOn(!isCameraOn);
  };

  const presentFile = (file: any) => {
      setSharedFile(file);
      setShowMedia(false);
  };

  // Grid logic
  const totalSlots = peers.length + 1; // Peers + Me
  const gridCols = totalSlots > 2 ? 'grid-cols-2' : 'grid-cols-1';
  const gridRows = totalSlots > 2 ? 'grid-rows-2' : totalSlots === 2 ? 'grid-rows-2' : 'grid-rows-1';

  return (
      <div className="h-full relative bg-black flex flex-col">
          <div className={`flex-1 grid ${gridCols} ${gridRows} gap-0.5 bg-slate-900 overflow-hidden`}>
               {/* USER SLOT */}
               <div className={`relative bg-slate-800 overflow-hidden ${hostId === LOCAL_USER_ID && totalSlots > 1 ? 'ring-2 ring-blue-500 z-10' : ''}`} onClick={() => setHostId(LOCAL_USER_ID)}>
                    {!isCameraOn ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-600">
                             <i className="fas fa-video-slash text-4xl mb-2"></i>
                             <span className="text-[10px] font-bold uppercase tracking-widest">Camera Off</span>
                        </div>
                    ) : (
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur rounded px-2 py-0.5 text-[9px] text-white flex items-center gap-1">
                        <i className={`fas fa-microphone${peers.length > 0 ? '' : '-slash'}`}></i> You
                    </div>
               </div>

               {/* PEER SLOTS */}
               {peers.map(peer => (
                   <div 
                        key={peer.id} 
                        className={`relative bg-slate-800 overflow-hidden transition-all ${hostId === peer.id ? 'ring-2 ring-blue-500 z-10' : ''}`}
                        onClick={() => setHostId(peer.id)}
                   >
                       <div className="w-full h-full flex flex-col items-center justify-center">
                            {peer.status === 'calling' ? (
                                <div className="text-center animate-pulse">
                                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-2 border border-slate-600">
                                        <i className="fas fa-phone text-slate-400"></i>
                                    </div>
                                    <span className="text-[10px] font-bold text-yellow-500 uppercase">Calling...</span>
                                </div>
                            ) : (
                                <div className="w-full h-full relative">
                                     {peer.avatar ? (
                                         <img src={peer.avatar} alt={peer.name} className="w-full h-full object-cover opacity-80" />
                                     ) : (
                                         <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 font-bold text-3xl">
                                             {peer.name.charAt(0)}
                                         </div>
                                     )}
                                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                                </div>
                            )}
                       </div>

                       <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur rounded px-2 py-0.5 text-[9px] text-white flex items-center gap-1">
                            <i className="fas fa-microphone"></i> {peer.name}
                       </div>

                       <button 
                           onClick={(e) => { e.stopPropagation(); removePeer(peer.id); }}
                           aria-label={`Remove ${peer.name}`}
                           className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] transition-colors"
                       >
                           <i className="fas fa-times"></i>
                       </button>
                   </div>
               ))}

               {sharedFile && (
                   <DraggablePresentationWindow 
                      file={sharedFile} 
                      onClose={() => setSharedFile(null)} 
                   />
               )}
          </div>

          <div className="h-24 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex items-center justify-center gap-4 px-4 z-30 pb-safe">
              <button aria-label={showMedia ? 'Close share panel' : 'Open share panel'} onClick={() => setShowMedia(!showMedia)} className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${showMedia ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  <i className="fas fa-share-square"></i>
              </button>
              
              <button 
                onClick={toggleCameraOn} 
                aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isCameraOn ? 'bg-blue-600 text-white' : 'bg-red-900/50 text-red-500 border border-red-500/50'}`}
                title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
              >
                  <i className={`fas fa-video${isCameraOn ? '' : '-slash'}`}></i>
              </button>

              <button aria-label="End call" className="w-14 h-14 rounded-full bg-red-600 text-white text-xl flex items-center justify-center shadow-lg hover:bg-red-500 active:scale-95 transition-transform">
                  <i className="fas fa-phone-slash"></i>
              </button>
              
              <button onClick={toggleCameraFacing} aria-label="Switch camera" className="w-11 h-11 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center">
                  <i className="fas fa-sync"></i>
              </button>

              <button onClick={() => setShowAddParticipant(true)} aria-label="Add participant" className="w-11 h-11 rounded-full bg-slate-800 text-blue-400 hover:bg-slate-700 flex items-center justify-center">
                  <i className="fas fa-user-plus"></i>
              </button>
          </div>

          {showMedia && (
               <div className="absolute bottom-24 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 animate-in slide-in-from-bottom duration-200 z-20 shadow-2xl">
                   <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Share Content</h3>
                   <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                       {files.map(file => (
                           <button key={file.id} onClick={() => presentFile(file)} className="shrink-0 w-20 flex flex-col gap-1 items-center">
                               <div className={`w-20 h-20 rounded-lg ${file.thumb} flex items-center justify-center text-white text-2xl`}>
                                                       {file.url && file.type === 'image' ? <img src={file.url} alt={file.name} className="w-full h-full object-cover rounded-lg"/> : <i className={`fas fa-${file.type === 'video' ? 'video' : 'file'}`}></i>}
                               </div>
                               <span className="text-[9px] text-slate-400 truncate w-full text-center">{file.name}</span>
                           </button>
                       ))}
                   </div>
               </div>
          )}

          <VideoCallModal 
             isOpen={showAddParticipant} 
             onClose={() => setShowAddParticipant(false)}
             contacts={contacts}
             onCall={addPeer}
          />
      </div>
  );
};

// ===================================================================================
//  MAIN COMPONENT (SHELL)
// ===================================================================================

const CommunicationsOutlet = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [tab, setTab] = useState('phone');
    const [notesOpen, setNotesOpen] = useState(false);
    const [files, setFiles] = useState<any[]>(INITIAL_FILES);
    const [notes, setNotes] = useState<string[]>([]);
    const [contacts, setContacts] = useState(INITIAL_CONTACTS);
    const [showContactsModal, setShowContactsModal] = useState(false);
    
    const [activeContactForAction, setActiveContactForAction] = useState<any>(null);

    const handleAskAI = async (prompt: string) => {
    };

    const handleUpload = (e: any) => {
        if(e.target.files?.[0]) {
            const file = e.target.files[0];
            const newFile = {
                id: Date.now(),
                type: file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'doc',
                name: file.name,
                thumb: 'bg-slate-700',
                url: URL.createObjectURL(file)
            };
            setFiles([newFile, ...files]);
        }
    }

    const handleAddContact = (newContact: any) => {
        setContacts([...contacts, { ...newContact, id: Date.now(), status: 'offline' }]);
    }
    const handleDeleteContact = (contact: any) => {
        try {
            globalTrashService.addItem({
                name: contact.name || 'Contact',
                originalPath: 'communications/contacts',
                size: 0,
                type: FileType.OTHER,
                category: 'contact',
                payload: contact
            });
        } catch (e) { console.warn('Failed to add contact to trash', e); }
        setContacts(prev => prev.filter(c => c.id !== contact.id));
        try { mlAdapter.putEvent('agent/actions/comms/', `delete_contact_${Date.now()}`, { contactId: contact.id }); } catch {}
    }
    
    const handleContactAction = (action: string, contact: any) => {
        if (action === 'phone') {
            setTab('phone');
        } else if (action === 'messages') {
            setTab('messages');
        } else if (action === 'video') {
            setTab('video');
            setActiveContactForAction(contact);
        }
    };

        // ==============================
        // LEEWAY: AGENT_CONTROL LAYER
        // ==============================
        useEffect(() => {
            AGENT_CONTROL.register('CommunicationsOutlet', {
                openTab: async ({ tab: next }: { tab: string }) => {
                    setTab(next);
                    await mlAdapter.putEvent('agent/actions/comms/', `tab_${Date.now()}`, { tab: next });
                    return { ok: true };
                },
                openNotes: async () => {
                    setNotesOpen(true);
                    await mlAdapter.putEvent('agent/actions/comms/', `notes_open_${Date.now()}`, {});
                    return { ok: true };
                },
                closeNotes: async () => {
                    setNotesOpen(false);
                    await mlAdapter.putEvent('agent/actions/comms/', `notes_close_${Date.now()}`, {});
                    return { ok: true };
                },
                startVideoWithContact: async ({ contactId }: { contactId: number }) => {
                    const c = contacts.find(x => x.id === contactId);
                    if (!c) throw new Error(`Contact not found: ${contactId}`);
                    setTab('video');
                    setActiveContactForAction(c);
                    await mlAdapter.putEvent('agent/actions/comms/', `video_${Date.now()}`, { contactId });
                    return { ok: true };
                },
                addContact: async ({ name, number }: { name: string; number: string }) => {
                    handleAddContact({ name, number });
                    await mlAdapter.putEvent('agent/actions/comms/', `add_contact_${Date.now()}`, { name, number });
                    return { ok: true };
                },
            });

            return () => AGENT_CONTROL.unregister('CommunicationsOutlet');
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [contacts, files]);

        // Register contact restore handler at component level (has access to setContacts)
        useEffect(() => {
            try {
                globalTrashService.registerRestoreHandler('contact', async (item: any) => {
                    if (!item || !item.payload) return false;
                    const payload = item.payload as any;
                    setContacts(prev => {
                        if (prev.find(p => p.id === payload.id)) return prev;
                        return [...prev, payload];
                    });
                    try { await mlAdapter.putEvent('agent/actions/comms/', `restore_contact_${Date.now()}`, { contactId: payload.id }); } catch {}
                    return true;
                });
            } catch (e) {
                console.warn('Failed to register contact restore handler', e);
            }
        }, []);

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm h-[800px] max-h-[90vh] bg-slate-950 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col relative ring-8 ring-slate-900">
                
                <div className="absolute top-0 left-0 right-0 h-8 flex justify-center pointer-events-none z-50">
                     <div className="w-32 h-6 bg-black rounded-b-2xl flex items-center justify-center gap-2 px-3">
                         <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                         <div className="w-12 h-1.5 rounded-full bg-slate-900/50"></div>
                     </div>
                </div>

                <div className="h-12 flex items-end justify-between px-6 pb-2 text-xs font-bold text-slate-400 bg-slate-950 pt-4">
                    <span>9:41</span>
                    <div className="flex gap-1.5">
                        <i className="fas fa-signal"></i>
                        <i className="fas fa-wifi"></i>
                        <i className="fas fa-battery-full"></i>
                    </div>
                </div>

                <div className="h-14 flex items-center justify-between px-4 z-50">
                    <button 
                        onClick={() => setNotesOpen(true)}
                        className="w-8 h-8 bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-full flex items-center justify-center text-yellow-500/80 hover:bg-slate-700/60 hover:text-yellow-400 transition-all active:scale-90"
                        title="Quick Notes"
                    >
                        <i className="fas fa-sticky-note text-sm"></i>
                    </button>

                    <button 
                        onClick={onClose}
                        className="w-8 h-8 bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-full flex items-center justify-center text-white/50 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                        title="Close"
                    >
                        <i className="fas fa-times text-sm"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative bg-slate-950">
                    {tab === 'phone' && (
                        <PhoneTab 
                           contacts={contacts} 
                           onAddContact={handleAddContact} 
                        />
                    )}
                    
                    {tab === 'messages' && (
                        <MessagesTab 
                            onAskAI={handleAskAI} 
                            files={files} 
                            onUpload={handleUpload} 
                        />
                    )}
                    
                    {tab === 'video' && (
                        <VideoTab 
                            files={files} 
                            onUpload={handleUpload} 
                            activeContact={activeContactForAction} 
                            contacts={contacts} 
                        />
                    )}
                    
                    {tab === 'permissions' && (
                        <div className="h-full flex items-center justify-center p-4">
                             <PermissionSwitch onEnable={() => setTab('phone')} />
                        </div>
                    )}
                </div>

                <div className="h-20 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 pb-4 pt-2">
                    {[
                        { id: 'phone', icon: 'fas fa-phone-alt', label: 'Phone' },
                        { id: 'messages', icon: 'fas fa-comment-alt', label: 'Messages' },
                        { id: 'video', icon: 'fas fa-video', label: 'Video' },
                        { id: 'contacts', icon: 'fas fa-address-book', label: 'Contacts', action: () => setShowContactsModal(true) },
                    ].map(t => (
                        <button 
                            key={t.id}
                            onClick={() => t.action ? t.action() : setTab(t.id)}
                            className={`flex flex-col items-center gap-1 w-16 p-1 rounded-xl transition-all duration-200 ${tab === t.id && !t.action ? 'text-blue-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className={`w-10 h-6 rounded-full flex items-center justify-center text-lg transition-all ${tab === t.id && !t.action ? 'bg-blue-500/10' : ''}`}>
                                <i className={t.icon}></i>
                            </div>
                            <span className="text-[10px] font-medium">{t.label}</span>
                        </button>
                    ))}
                </div>

            </div>

            <QuickNotesModal 
                isOpen={notesOpen} 
                onClose={() => setNotesOpen(false)} 
                notes={notes} 
                addNote={async (n: string) => {
                    const next = [...notes, n];
                    setNotes(next);
                    try {
                        await mlAdapter.putFile('communications/notes/', `note_${Date.now()}`, { text: n, timestamp: new Date().toISOString() });
                    } catch (e) { console.warn('Failed to persist quick note', e); }
                }} 
                onDelete={(i: number) => setNotes(notes.filter((_, idx) => idx !== i))}
            />

            <ContactsModal 
                isOpen={showContactsModal}
                onClose={() => setShowContactsModal(false)}
                contacts={contacts}
                onAction={(action: string, contact: any) => {
                    handleContactAction(action, contact);
                    setShowContactsModal(false);
                }}
                onAddContact={() => {
                    setShowContactsModal(false);
                }}
                onDeleteContact={(c: any) => { handleDeleteContact(c); setShowContactsModal(false); }}
            />

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </div>
    );
};

export default CommunicationsOutlet;
