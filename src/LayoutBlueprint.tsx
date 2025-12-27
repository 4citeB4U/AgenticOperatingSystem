/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.LAYOUTBLUEPRINT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   LayoutBlueprint.tsx
   
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


/* 
   AGENT LEE v38.0 - VISUAL LAYOUT BLUEPRINT
   Region: 🔵 UI.LAYOUT.BLUEPRINT
   Description: A static, logic-free reference of the component hierarchy and Tailwind classes.
   Use this to restore the visual "Shell" if logic layers fail.
*/

import {
    Camera,
    Cpu,
    FileCode,
    Globe,
    Mail,
    PanelLeftClose, PanelLeftOpen,
    Paperclip,
    Plus,
    Send,
    Settings,
    Terminal,
    Trash2
} from 'lucide-react';

const LayoutBlueprint = () => {
  // Static state for visual representation
  const leftOpen = true;
  const isThinking = false;

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
      
      {/* =========================================================================
          LEFT PANE: THE EXPLORER (VS Code Style)
          Classes: w-72, bg-[#0a0a0a], border-r border-[#1a1a1a]
      ========================================================================= */}
      <div className="w-72 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0a] shrink-0">
        
        {/* 1. Activity Bar Header */}
        <div className="flex flex-row h-12 border-b border-[#1a1a1a] items-center px-4 gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">EXPLORER</span>
        </div>

        {/* 2. Drive Selector Tabs */}
        <div className="flex p-2 gap-1 bg-[#0a0a0a] border-b border-[#1a1a1a]">
          {/* Active Drive */}
          <button className="h-8 flex-1 rounded flex items-center justify-center text-xs font-bold transition-all bg-[#1a1a1a] text-cyan-400 border border-gray-800">
            L
          </button>
          {/* Inactive Drive */}
          <button className="h-8 flex-1 rounded flex items-center justify-center text-xs font-bold transition-all text-gray-600 hover:text-gray-400">
            E
          </button>
        </div>

        {/* 3. File Tree */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Drive L Content</span>
            <button aria-label="Create new file" title="Create new file" className="p-1 hover:bg-[#222] rounded text-gray-400 hover:text-white"><Plus size={14}/></button>
          </div>
          
          {/* Active File Item */}
          <div className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs mb-0.5 transition-colors border-l-2 bg-[#151515] text-cyan-400 border-cyan-500">
            <FileCode size={12} className="text-cyan-500" />
            <span className="truncate flex-1">current_session.json</span>
            <button aria-label="Delete file" title="Delete file" className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"><Trash2 size={10} /></button>
          </div>

          {/* Inactive File Item */}
          <div className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs mb-0.5 transition-colors border-l-2 text-gray-400 hover:bg-[#111] hover:text-gray-200 border-transparent">
            <FileCode size={12} className="text-gray-600" />
            <span className="truncate flex-1">archived_memory.json</span>
          </div>
        </div>

        {/* 4. Left Footer */}
        <div className="p-2 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <button className="w-full flex items-center gap-2 p-2 rounded hover:bg-[#151515] text-xs text-gray-400">
            <Mail size={14}/> LeeMail
          </button>
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANE: THE CANVAS (Google AI Studio Style)
          Classes: flex-1, flex-col, relative
      ========================================================================= */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* 1. Canvas Header / Tabs */}
        <div className="h-12 border-b border-[#1a1a1a] bg-[#050505] flex items-center px-4 justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            <button aria-label={leftOpen ? 'Close explorer' : 'Open explorer'} title={leftOpen ? 'Close explorer' : 'Open explorer'} className="text-gray-500 hover:text-white">
              {leftOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}
            </button>
            {/* Filename Tab */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-[#111] rounded border border-[#222] text-xs text-gray-300">
              <Terminal size={12} className="text-cyan-500"/>
              <span className="font-mono">session_active.json</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Thinking Indicator Stub */}
            {isThinking && <span className="text-[10px] text-cyan-500 font-bold animate-pulse">NEURAL PROCESSING...</span>}
            <button aria-label="Open settings" title="Open settings" className="p-2 rounded hover:bg-[#1a1a1a] text-gray-500 hover:text-white"><Settings size={16}/></button>
          </div>
        </div>

        {/* 2. Main Viewport */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          
          {/* Background Layer (Voxel Agent Placeholder) */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-60 bg-gradient-to-b from-transparent to-black">
             {/* <VoxelAgent /> goes here */}
          </div>

          {/* Chat Stream */}
          <div className="flex-1 z-10 overflow-y-auto p-4 md:p-10 space-y-6 custom-scrollbar scroll-smooth">
            
            {/* Empty State / Welcome */}
            <div className="h-full flex flex-col items-center justify-center opacity-40 select-none pointer-events-none">
                <Cpu size={64} className="mb-4 text-cyan-800"/>
                <h1 className="text-2xl font-bold tracking-[0.2em] text-cyan-900">AGENT LEE</h1>
                <p className="text-xs font-mono text-gray-600 mt-2">SYSTEM READY // DRIVE L MOUNTED</p>
            </div>

            {/* Message: User */}
            <div className="flex justify-end">
                <div className="max-w-[80%] md:max-w-[60%] flex flex-col gap-1 items-end">
                    <span className="text-[10px] font-mono text-gray-600 uppercase mb-1">USER</span>
                    <div className="p-4 rounded-xl backdrop-blur-md shadow-xl border bg-cyan-950/30 border-cyan-900/50 text-cyan-50 rounded-tr-none">
                        Show me the blueprints.
                    </div>
                </div>
            </div>

            {/* Message: Agent */}
            <div className="flex justify-start">
                <div className="max-w-[80%] md:max-w-[60%] flex flex-col gap-1 items-start">
                    <span className="text-[10px] font-mono text-gray-600 uppercase mb-1">AGENT</span>
                    <div className="p-4 rounded-xl backdrop-blur-md shadow-xl border bg-[#0a0a0a]/80 border-gray-800 text-gray-300 rounded-tl-none">
                        Accessing archive... visual layout restored.
                    </div>
                </div>
            </div>

          </div>

          {/* Input Dock (Floating) */}
          <div className="p-4 md:p-6 z-20 shrink-0">
            <div className="max-w-4xl mx-auto bg-[#0a0a0a]/90 backdrop-blur-xl border border-gray-800 rounded-xl flex flex-col shadow-2xl">
                <textarea 
                    placeholder="Type a command or query..."
                    className="w-full bg-transparent border-none p-4 text-sm text-gray-200 placeholder-gray-600 focus:ring-0 resize-none h-14 max-h-32 custom-scrollbar"
                />
                <div className="flex justify-between items-center px-2 pb-2">
                    <div className="flex gap-1 text-gray-500">
                        <button aria-label="Attach photo" title="Attach photo" className="p-2 hover:text-cyan-400 hover:bg-[#1a1a1a] rounded"><Camera size={16}/></button>
                        <button aria-label="Attach file" title="Attach file" className="p-2 hover:text-cyan-400 hover:bg-[#1a1a1a] rounded"><Paperclip size={16}/></button>
                        <button aria-label="Toggle web" title="Toggle web" className="p-2 hover:text-cyan-400 hover:bg-[#1a1a1a] rounded"><Globe size={16}/></button>
                    </div>
                    <button aria-label="Send message" title="Send message" className="p-2 bg-cyan-900/50 hover:bg-cyan-600 text-cyan-200 hover:text-white rounded-lg transition-all border border-cyan-800/50">
                      <Send size={16}/>
                    </button>
                </div>
            </div>
            <div className="text-center mt-2 text-[9px] text-gray-600 font-mono">
                AGENT LEE v38 // VISUAL BLUEPRINT
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LayoutBlueprint;
