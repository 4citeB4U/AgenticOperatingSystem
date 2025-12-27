/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.EMAILCENTER.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   EmailCenter.tsx
   
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
import { X } from 'lucide-react';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AGENT_CONTROL } from './coreRegistry';
import './EmailCenter.css';
import { mlAdapter } from './memoryLakeAdapter';
import { isAllowed } from './policyClient';
// Lazy-load three and heavy postprocessing modules at runtime
let THREE: any = null;
let OrbitControls: any = null;
let EffectComposer: any = null;
let RenderPass: any = null;
let UnrealBloomPass: any = null;

// --- Types & Interfaces ---
export interface NeuralFile {
  driveId: string;
  slotId: number;
  path: string;
  name: string;
  content: string;
  category: string;
  extension: string;
  signature: string;
  updatedAt: number;
  createdAt: number;
}

export interface TaskItem {
  id: string;
  label: string;
  date: string;
  time: string;
  status: 'queued' | 'needs_approval' | 'completed' | 'failed';
}

export interface Email {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  timestamp: string;
  body: string;
  isRead: boolean;
  isDeleted: boolean;
  isQuarantined: boolean;
  priority: 'High' | 'Normal' | 'Low';
  tags: string[];
  analysis?: EmailAnalysis;
  attachments?: { name: string; dataUrl: string; type: string }[];
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  status: 'ONLINE' | 'OFFLINE' | 'ENCRYPTED';
  lastSeen: string;
  bio: string;
}

export interface EmailAnalysis {
  summary: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Urgent';
  actionItems: string[];
  phishingScore: number; 
  threatLevel: 'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
}

export interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
  type?: 'log' | 'finding' | 'summary';
}

export type Folder = 'Inbox' | 'Contacts Mail' | 'Sent Mail' | 'Drafts' | 'Trash' | 'Contacts' | 'Calendar' | 'To Do List';
export type InboxFilter = 'ALL' | 'UNREAD';

export interface VoxelAgentHandle {
  speak: () => void;
  stop: () => void;
  pulse: () => void;
}

// --- Icons ---
const Icons = {
  Plus: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Menu: (p: any) => <svg {...p} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>,
  User: (p: any) => <svg {...p} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Send: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Trash: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Inbox: (p: any) => <svg {...p} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  ArrowLeft: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
  Bot: (p: any) => (
    <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 8V4m0 4l-4-4m4 4l4-4" strokeLinecap="round" />
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <circle cx="8" cy="14" r="1" fill="currentColor" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
      <path d="M10 17h4" strokeLinecap="round" />
    </svg>
  ),
  Paperclip: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Download: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Eye: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11-8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Shield: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Clock: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Calendar: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  ChevronDown: (p: any) => <svg {...p} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>,
  Edit: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Message: (p: any) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

// --- Memory Lake Logic ---
const lakeChannel = new BroadcastChannel("agentlee-memorylake");

// --- Mock Data ---
const INITIAL_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Director Fury', email: 'fury@shield.gov', status: 'ONLINE', lastSeen: 'Active Now', bio: 'Strategic Ops Lead.' },
  { id: 'c2', name: 'Tony Stark', email: 'stark@stark.corp', status: 'ENCRYPTED', lastSeen: '2m ago', bio: 'Lead R&D. Voxel Architect.' },
  { id: 'c7', name: 'Leeway Support', email: 'core@leeway.industries', status: 'ONLINE', lastSeen: 'Now', bio: 'AI Maintenance.' },
];

const INITIAL_EMAILS: Email[] = [
  { id: 'e1', threadId: 't1', sender: 'Global Ops', senderEmail: 'ops@global.net', subject: 'System Diagnostic Required', timestamp: '10:42 AM', body: 'Please review the latest Sector 7 logs. We are seeing odd spikes in the vortex core.', isRead: false, isDeleted: false, isQuarantined: false, priority: 'High', tags: [], analysis: { summary: "Request for vortex core diagnostic review.", sentiment: 'Neutral', actionItems: ['Review logs'], phishingScore: 0.05, threatLevel: 'CLEAN' } },
  { id: 'e2', threadId: 't2', sender: 'Newsletter', senderEmail: 'info@tech-weekly.com', subject: 'Weekly Voxel Update', timestamp: 'Yesterday', body: 'New rendering techniques available. InstancedMesh now supports 50k+ nodes with minimal overhead.', isRead: true, isDeleted: false, isQuarantined: false, priority: 'Low', tags: [], analysis: { summary: "Updates on voxel rendering performance.", sentiment: 'Positive', actionItems: [], phishingScore: 0.0, threatLevel: 'CLEAN' } },
  { id: 'e3', threadId: 't3', sender: 'Cloud Admin', senderEmail: 'admin@leeway.io', subject: 'Storage Threshold Reached', timestamp: '08:00 AM', body: 'Your Memory Lake is at 85% capacity. Consider purging older log files.', isRead: false, isDeleted: false, isQuarantined: false, priority: 'Normal', tags: [], analysis: { summary: "Memory Lake capacity warning.", sentiment: 'Neutral', actionItems: ['Purge logs'], phishingScore: 0.0, threatLevel: 'CLEAN' } },
  { id: 'c-e1', threadId: 'ct1', sender: 'Director Fury', senderEmail: 'fury@shield.gov', subject: 'Core Protocol Breach', timestamp: '09:15 AM', body: 'Diagnostic tools reporting unauthorized egress in Sector 7 cluster. Seal the nodes immediately.', isRead: false, isDeleted: false, isQuarantined: false, priority: 'High', tags: ['MISSION'], analysis: { summary: "Urgent breach in Sector 7 requires immediate node sealing.", sentiment: 'Urgent', actionItems: ['Scan sector 7', 'Seal nodes'], phishingScore: 0.05, threatLevel: 'CLEAN' } },
  { id: 'c-e2', threadId: 'ct2', sender: 'Tony Stark', senderEmail: 'stark@stark.corp', subject: 'Voxel Shader v2.4', timestamp: '2h ago', body: 'The new lighting model is ready for integration. Check the Reactor Core reaction intensities.', isRead: true, isDeleted: false, isQuarantined: false, priority: 'Normal', tags: [], analysis: { summary: "Shader update for Reactor Core visuals.", sentiment: 'Positive', actionItems: [], phishingScore: 0.0, threatLevel: 'CLEAN' } },
  { id: 's1', threadId: 'st1', sender: 'You', senderEmail: 'operator@neural.net', subject: 'Re: System Diagnostic', timestamp: '11:00 AM', body: 'Diagnostic initiated. Results pending.', isRead: true, isDeleted: false, isQuarantined: false, priority: 'Normal', tags: ['SENT'], analysis: { summary: "Sent response confirming diagnostic start.", sentiment: 'Neutral', actionItems: [], phishingScore: 0.0, threatLevel: 'CLEAN' } },
  { id: 'd1', threadId: 'dt1', sender: 'You', senderEmail: 'operator@neural.net', subject: 'Project Phoenix Pitch', timestamp: 'Draft', body: 'We propose a new agentic architecture for global communication...', isRead: true, isDeleted: false, isQuarantined: false, priority: 'Normal', tags: ['DRAFT'], analysis: { summary: "Draft proposal for Project Phoenix architecture.", sentiment: 'Positive', actionItems: [], phishingScore: 0.0, threatLevel: 'CLEAN' } },
  { id: 't1', threadId: 'tr1', sender: 'Spam Bot', senderEmail: 'win@free-credits.io', subject: 'YOU WON CREDITS!', timestamp: 'Oct 12', body: 'Click here for your prize! No verification needed.', isRead: true, isDeleted: true, isQuarantined: false, priority: 'Low', tags: [], analysis: { summary: "Phishing attempt disguised as a giveaway.", sentiment: 'Negative', actionItems: [], phishingScore: 0.9, threatLevel: 'SUSPICIOUS' } },
];

const INITIAL_AGENT_HISTORY: ChatMessage[] = [
  { role: 'agent', text: 'Agent Lee - Agentic Operating System initialized. Secure hub active. Every action is being logged to the Memory Lake.', timestamp: '09:00 AM' },
];

// --- The Core (Vortex Reactor Visualizer) ---
const VoxelAgent = forwardRef(({ className }: { className?: string }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ isSpeaking: false, intensity: 0, currentPulse: 0 });
  const cameraRef = useRef<any>(null);
  
  useImperativeHandle(ref, () => ({
    speak: () => { stateRef.current.isSpeaking = true; },
    stop: () => { stateRef.current.isSpeaking = false; },
    pulse: () => { stateRef.current.currentPulse = 1.5; } 
  }));

  useEffect(() => {
    let renderer: any = null;
    let reqId: number | null = null;
    let composer: any = null;
    let ro: ResizeObserver | null = null;

    const resize = () => {
      if (!renderer || !composer) return;
      const container = mountRef.current;
      if (!container) return;
      const newW = container.clientWidth || 400;
      const newH = container.clientHeight || 300;
      if (newW === 0 || newH === 0) return;
      renderer.setSize(newW, newH);
      if (composer.setSize) composer.setSize(newW, newH);
      if (cameraRef.current) {
        const cam: any = cameraRef.current;
        cam.aspect = newW / newH;
        cam.updateProjectionMatrix();
      }
    };

    (async () => {
      if (!THREE) {
        const [threeMod, orbitMod, composerMod, renderPassMod, bloomMod] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls'),
          import('three/examples/jsm/postprocessing/EffectComposer'),
          import('three/examples/jsm/postprocessing/RenderPass'),
          import('three/examples/jsm/postprocessing/UnrealBloomPass'),
        ]);
        THREE = threeMod;
        const _orbit: any = orbitMod as any;
        const _composerMod: any = composerMod as any;
        const _renderPassMod: any = renderPassMod as any;
        const _bloomMod: any = bloomMod as any;
        OrbitControls = _orbit.OrbitControls ?? _orbit.default ?? _orbit;
        EffectComposer = _composerMod.EffectComposer ?? _composerMod.default ?? _composerMod;
        RenderPass = _renderPassMod.RenderPass ?? _renderPassMod.default ?? _renderPassMod;
        UnrealBloomPass = _bloomMod.UnrealBloomPass ?? _bloomMod.default ?? _bloomMod;
      }

      const container = mountRef.current;
      if (!container) return;
      container.innerHTML = '';
      const w = container.clientWidth || 400, h = container.clientHeight || 300;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 1000);
      camera.position.set(0, 4, 65);
      cameraRef.current = camera;
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: true });
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
      const bolts: any[] = []; const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
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
      composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.5, 0.4, 0.85); bloomPass.threshold = 0; bloomPass.strength = CONFIG.baseBloom; bloomPass.radius = 0.5; composer.addPass(bloomPass);

      let time = 0;
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
        (mouthMesh.material as any).opacity = 0.8 + (strobe * 0.5);
        if(stateRef.current.isSpeaking && strobe > 0.8) { const shake = (strobe - 0.8) * 0.6; camera.position.x += (Math.random()-0.5) * shake; camera.position.y += (Math.random()-0.5) * shake; }
        composer.render();
      };
      animate();

      // ENGINEER FIX: Responding to parent container resizing ensures visibility when the panel slides in.
      ro = new ResizeObserver(resize);
      ro.observe(container);
    })();

    return () => {
      if (ro) ro.disconnect();
      if (reqId) cancelAnimationFrame(reqId);
      if (renderer) renderer.dispose();
    };
  }, []);
  return <div ref={mountRef} className={`${className} agent-mount`} />;
});

// --- Main App ---
export const EmailCenter: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [emails, setEmails] = useState<Email[]>(INITIAL_EMAILS);
  const [contacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<Folder>('Inbox');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('ALL');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [agentHistory, setAgentHistory] = useState<ChatMessage[]>(INITIAL_AGENT_HISTORY);
  const [agentChatText, setAgentChatText] = useState('');
  const [search, setSearch] = useState('');
  
  // File System State
  const [previewFile, setPreviewFile] = useState<{name: string, type: string, dataUrl: string} | null>(null);
  const [composeAttachments, setComposeAttachments] = useState<{name: string, type: string, dataUrl: string}[]>([]);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isLiveMail, setIsLiveMail] = useState(false);

  const agentRef = useRef<VoxelAgentHandle>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const selectedEmail = useMemo(() => emails.find(e => e.id === selectedId), [emails, selectedId]);
  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId), [contacts, selectedContactId]);
  const contactEmailsList = useMemo(() => contacts.map(c => c.email.toLowerCase()), [contacts]);

  // Folder Statistics Calculation
  const emailStats = useMemo(() => {
    const isContact = (email: string) => contactEmailsList.includes(email.toLowerCase());
    return {
      inbox: emails.filter(e => !e.isDeleted && !isContact(e.senderEmail) && !e.tags.includes('SENT') && !e.tags.includes('DRAFT')).length,
      unreadInbox: emails.filter(e => !e.isRead && !e.isDeleted && !isContact(e.senderEmail) && !e.tags.includes('SENT') && !e.tags.includes('DRAFT')).length,
      contactsMail: emails.filter(e => !e.isDeleted && isContact(e.senderEmail) && !e.tags.includes('SENT') && !e.tags.includes('DRAFT')).length,
      unreadContactsMail: emails.filter(e => !e.isRead && !e.isDeleted && isContact(e.senderEmail) && !e.tags.includes('SENT') && !e.tags.includes('DRAFT')).length,
      sent: emails.filter(e => e.tags.includes('SENT') && !e.isDeleted).length,
      drafts: emails.filter(e => e.tags.includes('DRAFT') && !e.isDeleted).length,
      trash: emails.filter(e => e.isDeleted).length,
    };
  }, [emails, contactEmailsList]);

  const filteredEmails = useMemo(() => {
    return emails.filter(e => {
      const isFromContact = contactEmailsList.includes(e.senderEmail.toLowerCase());
      const matchesSearch = e.subject.toLowerCase().includes(search.toLowerCase()) || e.sender.toLowerCase().includes(search.toLowerCase());
      if (e.isDeleted && currentFolder !== 'Trash') return false;
      
      switch (currentFolder) {
        case 'Inbox':
          return !isFromContact && !e.tags.includes('SENT') && !e.tags.includes('DRAFT') && matchesSearch && (inboxFilter === 'ALL' || !e.isRead);
        case 'Contacts Mail':
          return isFromContact && !e.tags.includes('SENT') && !e.tags.includes('DRAFT') && matchesSearch && (inboxFilter === 'ALL' || !e.isRead);
        case 'Sent Mail':
          return e.tags.includes('SENT') && matchesSearch;
        case 'Drafts':
          return e.tags.includes('DRAFT') && matchesSearch;
        case 'Trash':
          return e.isDeleted && matchesSearch;
        default:
          return false;
      }
    });
  }, [emails, currentFolder, inboxFilter, search, contactEmailsList]);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const files = await mlAdapter.listByPathPrefix('leemail/tasks/');
        const loaded = await Promise.all(
          files.map(async (f) => {
            try {
              const txt = await mlAdapter.readFileText(f.id);
              return txt ? JSON.parse(txt) as TaskItem : null;
            } catch (e) {
              return null;
            }
          })
        );
        setTasks(loaded.filter((x): x is TaskItem => x !== null));
      } catch (e) {
        // ignore
      }
    };
    loadTasks();
  }, []);

  // --- Context Awareness Intelligence ---
  const handleOpenAgentLee = async () => {
    setIsAgentPanelOpen(true);
    agentRef.current?.pulse();
    agentRef.current?.speak();

    let contextMessage = "";
    
    if (currentFolder === 'Calendar') {
      contextMessage = "Neural timeline synchronized. I've indexed your upcoming nodes. Do you need assistance marking new dates or adjusting your current schedule?";
    } else if (currentFolder === 'To Do List') {
      contextMessage = "Operational priorities loaded. You have active tasks pending. Shall I help you organize the stack or identify high-priority items?";
    } else if (currentFolder === 'Trash') {
      contextMessage = `Data decay zone detected. I see ${emailStats.trash} nodes marked for deletion. Would you like me to purge the entire bin or attempt a restore on specific files?`;
    } else if (currentFolder === 'Drafts') {
      contextMessage = `Unsent data streams identified. You have ${emailStats.drafts} pending drafts. I can help you finalize these or automate the transmission process for you.`;
    } else if (currentFolder === 'Contacts') {
      contextMessage = "Node directory active. I can help you locate a specific agent or initiate a new secure mail connection to any identified contact.";
    } else if (selectedId) {
      contextMessage = `This is my findings for the email from ${selectedEmail?.sender}. I've processed the summary and identified key notations for the Memory Lake. Do you want me to deep-dive further or read the full content?`;
    } else if (currentFolder === 'Inbox' || currentFolder === 'Contacts Mail') {
      const unreadCount = currentFolder === 'Inbox' ? emailStats.unreadInbox : emailStats.unreadContactsMail;
      const totalCount = currentFolder === 'Inbox' ? emailStats.inbox : emailStats.contactsMail;
      if (unreadCount > 0) {
        contextMessage = `Scanning ${currentFolder} stream... I've detected ${unreadCount} unread emails out of ${totalCount}. Would you like a comprehensive summary of all pending data? I can also highlight urgent items.`;
      } else {
        contextMessage = `The ${currentFolder} stream is clear. ${totalCount} nodes archived. How can I assist with your future planning?`;
      }
    } else {
      contextMessage = "Agent Lee active. Systems nominal. How can I help you navigate the agentic operating system?";
    }

    // Log this interaction to Memory Lake
    await mlAdapter.putFile("agent/interactions/", `interaction_${Date.now()}`, { message: contextMessage, folder: currentFolder, selectedId });

    setAgentHistory(prev => [...prev, { role: 'agent', text: contextMessage, timestamp: 'Now', type: 'finding' }]);
    setTimeout(() => agentRef.current?.stop(), 3000);
  };

  const batchSummarize = async () => {
    const unread = filteredEmails.filter(e => !e.isRead);
    if (unread.length === 0) {
        setAgentHistory(prev => [...prev, { role: 'agent', text: "No unread mail streams to summarize in this folder.", timestamp: 'Now' }]);
        return;
    }
    
    agentRef.current?.pulse();
    agentRef.current?.speak();
    setAgentHistory(prev => [...prev, { role: 'agent', text: "Analyzing all unread mail streams... Classifying urgency.", timestamp: 'Now' }]);

    try {
      if (!isAllowed('REMOTE_LLM')) {
        setAgentHistory(prev => [...prev, { role: 'agent', text: 'Remote LLM calls are blocked by Zero-Egress policy. Enable remote LLM to run summaries.', timestamp: 'Now' }]);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as Agent Lee, an agentic OS. Summarize these emails concisely and classify each as URGENT (Action required) or NORMAL (FYI). Highlight the most critical item first.
      Emails: ${unread.map(e => `[Sender: ${e.sender}, Subject: ${e.subject}] Body Sample: ${e.body.substring(0, 50)}`).join('\n')}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      const findingText = "This is my findings for the unread folder stream:\n\n" + response.text;
      setAgentHistory(prev => [...prev, { role: 'agent', text: findingText, timestamp: 'Now', type: 'summary' }]);
      
      // Save findings to Memory Lake
      await mlAdapter.putFile("agent/summaries/", `summary_${Date.now()}`, { summary: response.text, count: unread.length });

    } catch (e) {
      setAgentHistory(prev => [...prev, { role: 'agent', text: "Intelligence stream stream interrupted. Please retry summarization.", timestamp: 'Now' }]);
    } finally {
      agentRef.current?.stop();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setComposeAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          dataUrl: dataUrl
        }]);
        agentRef.current?.pulse();
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendEmail = async () => {
    if (!composeRecipient || !composeSubject) return;

    const newEmail: Email = {
      id: Math.random().toString(36).substring(7),
      threadId: Math.random().toString(36).substring(7),
      sender: "You",
      senderEmail: "operator@neural.net",
      subject: composeSubject,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      body: composeBody,
      isRead: true,
      isDeleted: false,
      isQuarantined: false,
      priority: 'Normal',
      tags: ['SENT'],
      attachments: composeAttachments,
      analysis: {
        summary: `Email sent via ${isLiveMail ? 'Live Mail' : 'Standard Email'}.`,
        sentiment: 'Neutral',
        actionItems: [],
        phishingScore: 0.0,
        threatLevel: 'CLEAN'
      }
    };

    setEmails(prev => [newEmail, ...prev]);
    setIsComposeOpen(false);
    
    // Log transmission to Memory Lake
    await mlAdapter.putFile("leemail/sent/", `sent_${newEmail.id}`, newEmail);

    setComposeAttachments([]);
    setComposeRecipient('');
    setComposeSubject('');
    setComposeBody('');
    setIsLiveMail(false);
    agentRef.current?.pulse();
  };

  // ==============================
  // LEEWAY: AGENT_CONTROL LAYER
  // ==============================
  useEffect(() => {
    const openEmail = async ({ emailId }: { emailId: string }) => {
      setSelectedId(emailId);
      await mlAdapter.putEvent('agent/actions/email/', `open_${Date.now()}`, { emailId });
      return { ok: true };
    };

    const closeEmail = async () => {
      setSelectedId(null);
      await mlAdapter.putEvent('agent/actions/email/', `close_${Date.now()}`, {});
      return { ok: true };
    };

    const deleteEmail = async ({ emailId }: { emailId: string }) => {
      handleDeleteEmail(emailId);
      await mlAdapter.putEvent('agent/actions/email/', `delete_${Date.now()}`, { emailId });
      return { ok: true };
    };

    const markSpam = async ({ emailId }: { emailId: string }) => {
      setEmails(prev =>
        prev.map(e =>
          e.id === emailId
            ? {
                ...e,
                tags: Array.from(new Set([...(e.tags || []), 'SPAM'])),
                analysis: {
                  ...(e.analysis || {}),
                  threatLevel: 'CRITICAL',
                  phishingScore: Math.max(e.analysis?.phishingScore ?? 0, 0.9),
                  sentiment: e.analysis?.sentiment || 'Negative',
                  actionItems: e.analysis?.actionItems || [],
                  summary: (e.analysis?.summary || 'Marked as spam by Agent Lee.') + ' [SPAM]',
                },
              }
            : e
        )
      );
      await mlAdapter.putEvent('agent/actions/email/', `spam_${Date.now()}`, { emailId });
      return { ok: true };
    };

    const replyToEmail = async ({
      emailId,
      body,
      sendNow = false,
    }: {
      emailId: string;
      body: string;
      sendNow?: boolean;
    }) => {
      const email = emails.find(e => e.id === emailId);
      if (!email) throw new Error(`Email not found: ${emailId}`);

      setIsComposeOpen(true);
      setComposeRecipient(email.senderEmail);
      setComposeSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`);
      setComposeBody(body || '');

      await mlAdapter.putEvent('agent/actions/email/', `reply_prepare_${Date.now()}`, {
        emailId,
        to: email.senderEmail,
        subject: email.subject,
        sendNow,
      });

      if (sendNow) {
        setTimeout(() => {
          void handleSendEmail();
        }, 0);
      }

      return { ok: true };
    };

    AGENT_CONTROL.register('EmailCenter', {
      openEmail,
      closeEmail,
      deleteEmail,
      markSpam,
      replyToEmail,
      openFolder: async ({ folder }: { folder: Folder }) => {
        setCurrentFolder(folder);
        await mlAdapter.putEvent('agent/actions/email/', `folder_${Date.now()}`, { folder });
        return { ok: true };
      },
      searchMail: async ({ q }: { q: string }) => {
        setSearch(q || '');
        await mlAdapter.putEvent('agent/actions/email/', `search_${Date.now()}`, { q });
        return { ok: true };
      },
    });

    return () => AGENT_CONTROL.unregister('EmailCenter');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emails]);

  const handleDownload = (dataUrl: string, name: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    agentRef.current?.pulse();
  };

  const handleDeleteEmail = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isDeleted: true } : e));
    setSelectedId(null);
    agentRef.current?.pulse();
  };

  const triggerPreview = (dataUrl: string, name: string, type: string = 'unknown') => {
    agentRef.current?.pulse();
    setPreviewFile({ name, dataUrl, type });
  };

  const handleSummarizeSingleEmail = async (email: Email, e: React.MouseEvent) => {
    e.stopPropagation(); agentRef.current?.pulse();
    const sum = email.analysis?.summary || 'Deep scan in progress... email verified.';
    const findingText = `This is my findings for the email from ${email.sender}:\n\n${sum}\n\nDo you want me to read the full content or archive this notation?`;
    
    setAgentHistory(prev => [...prev, { role: 'agent', text: findingText, timestamp: 'Now', type: 'finding' }]);
    setIsAgentPanelOpen(true); 
    agentRef.current?.speak(); 
    
    // Log finding to Memory Lake
    await mlAdapter.putFile("agent/findings/", `finding_${email.id}`, { emailId: email.id, findings: sum });

    setTimeout(() => agentRef.current?.stop(), 2500);
  };

  const handleAgentChat = async () => {
    if (!agentChatText.trim()) return;
    setAgentHistory(prev => [...prev, { role: 'user', text: agentChatText, timestamp: 'Now' }]); 
    const currentInput = agentChatText;
    setAgentChatText(''); 
    agentRef.current?.pulse();
    
    setTimeout(async () => {
      const response = "Directive processed. Operating system nominal. Record synchronized to Memory Lake.";
      setAgentHistory(prev => [...prev, { role: 'agent', text: response, timestamp: 'Now' }]);
      agentRef.current?.speak(); 
      
      // Log interaction
      await mlAdapter.putFile("agent/logs/", `log_${Date.now()}`, { user: currentInput, agent: response });

      setTimeout(() => agentRef.current?.stop(), 1500);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] h-screen w-screen flex flex-col bg-black text-slate-100 font-mono overflow-hidden">
      <header className="h-14 border-b border-cyan-500/10 bg-slate-900/40 backdrop-blur-xl flex items-center px-4 justify-between z-[200] shrink-0">
        <div className="flex items-center gap-4">
          <button aria-label="Open sidebar" onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg text-cyan-400 transition-colors"><Icons.Menu /></button>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <h1 className="text-sm font-bold tracking-[0.3em] uppercase">LeeMail</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Talk to Agent Lee" onClick={handleOpenAgentLee} className="p-2 rounded-lg text-slate-500 hover:text-cyan-400 bg-slate-800/40 border border-slate-700/50 shadow-inner group relative">
            <Icons.Bot />
            <div className="absolute top-full right-0 mt-2 p-2 bg-black border border-slate-800 rounded text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Talk to Agent Lee</div>
          </button>
          <button aria-label="Close" onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <aside className={`fixed inset-0 z-[300] transition-all duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <div className={`absolute top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
             <div className="p-6 space-y-6 h-full overflow-y-auto custom-scrollbar">
                <button onClick={() => { setIsComposeOpen(true); setIsSidebarOpen(false); }} className="w-full bg-cyan-500 text-slate-950 h-12 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-widest shadow-xl hover:bg-cyan-400 transition-colors"><Icons.Plus /> Create Email</button>
                <div className="space-y-1">
                  <NavGroup label="Inbox" icon={<Icons.Inbox />} expanded={true} active={currentFolder==='Inbox'} count={emailStats.inbox}>
                    <NavSubItem label="All Email" active={inboxFilter==='ALL' && currentFolder==='Inbox'} onClick={() => {setCurrentFolder('Inbox'); setInboxFilter('ALL'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.inbox} />
                    <NavSubItem label="Unread Only" active={inboxFilter==='UNREAD' && currentFolder==='Inbox'} onClick={() => {setCurrentFolder('Inbox'); setInboxFilter('UNREAD'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.unreadInbox} />
                  </NavGroup>
                  <NavGroup label="Contacts Mail" icon={<Icons.Message />} expanded={true} active={currentFolder==='Contacts Mail'} count={emailStats.contactsMail}>
                    <NavSubItem label="All Contact Mail" active={inboxFilter==='ALL' && currentFolder==='Contacts Mail'} onClick={() => {setCurrentFolder('Contacts Mail'); setInboxFilter('ALL'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.contactsMail} />
                    <NavSubItem label="Unread Contacts" active={inboxFilter==='UNREAD' && currentFolder==='Contacts Mail'} onClick={() => {setCurrentFolder('Contacts Mail'); setInboxFilter('UNREAD'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.unreadContactsMail} />
                  </NavGroup>
                  <NavItem label="Sent Mail" icon={<Icons.Send />} active={currentFolder==='Sent Mail'} onClick={() => {setCurrentFolder('Sent Mail'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.sent} />
                  <NavItem label="Drafts" icon={<Icons.Edit />} active={currentFolder==='Drafts'} onClick={() => {setCurrentFolder('Drafts'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.drafts} />
                  <NavItem label="Trash" icon={<Icons.Trash />} active={currentFolder==='Trash'} onClick={() => {setCurrentFolder('Trash'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} count={emailStats.trash} />
                  <div className="pt-4 border-t border-slate-800">
                    <NavItem label="Contacts" icon={<Icons.User />} active={currentFolder==='Contacts'} onClick={() => {setCurrentFolder('Contacts'); setSelectedContactId(null); setSelectedId(null); setIsSidebarOpen(false);}} />
                    <NavItem label="Calendar" icon={<Icons.Calendar />} active={currentFolder==='Calendar'} onClick={() => {setCurrentFolder('Calendar'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} />
                    <NavItem label="To Do List" icon={<Icons.Clock />} active={currentFolder==='To Do List'} onClick={() => {setCurrentFolder('To Do List'); setSelectedId(null); setSelectedContactId(null); setIsSidebarOpen(false);}} />
                  </div>
                </div>
             </div>
          </div>
        </aside>

        <section className={`flex-1 flex flex-col overflow-hidden ${(selectedId || selectedContactId || currentFolder==='Calendar' || currentFolder==='To Do List') ? 'hidden' : 'flex'}`}>
           <div className="h-10 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/40 shrink-0">
             <div className="flex items-center gap-3">
               {currentFolder !== 'Inbox' && <button aria-label="Back to inbox" onClick={() => setCurrentFolder('Inbox')} className="p-1 hover:text-cyan-400 transition-colors"><Icons.ArrowLeft className="w-3.5 h-3.5" /></button>}
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{currentFolder}</span>
             </div>
             {(currentFolder === 'Inbox' || currentFolder === 'Contacts Mail') && filteredEmails.some(e => !e.isRead) && (
               <button onClick={batchSummarize} className="text-[9px] bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 px-3 py-1 rounded-full font-bold uppercase tracking-widest transition-all">Neural Summary ({filteredEmails.filter(e=>!e.isRead).length})</button>
             )}
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar">
             {currentFolder === 'Contacts' ? (
               <div className="p-2 space-y-1">
                 {contacts.map(c => (
                   <div key={c.id} onClick={() => setSelectedContactId(c.id)} className="p-4 rounded-xl hover:bg-slate-800/40 cursor-pointer flex items-center justify-between border border-transparent hover:border-slate-800 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-cyan-400 font-bold border border-slate-700">{c.name[0]}</div>
                        <div>
                          <div className="text-[12px] font-bold text-slate-200">{c.name}</div>
                          <div className="text-[10px] text-slate-600 font-mono tracking-tight">{c.email}</div>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${c.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-slate-700'}`} />
                   </div>
                 ))}
               </div>
             ) : (
               filteredEmails.map(e => (
                 <div key={e.id} onClick={() => setSelectedId(e.id)} className={`p-4 border-b border-slate-800/50 cursor-pointer transition-all hover:bg-slate-800/40 border-l-2 relative group ${selectedId === e.id ? 'bg-cyan-500/5 border-l-cyan-500' : 'border-l-transparent'}`}>
                   <div className="flex justify-between mb-1.5 text-[9px] uppercase tracking-wider">
                     <span className={!e.isRead ? 'text-white' : 'text-slate-600'}>{e.sender}</span>
                     <span className="text-slate-700">{e.timestamp}</span>
                   </div>
                   <h3 className={`text-[12px] font-bold mb-1 truncate ${!e.isRead ? 'text-slate-100 font-bold' : 'text-slate-500 font-medium'}`}>{e.subject}</h3>
                   <p className="text-[10px] text-slate-600 line-clamp-1 leading-relaxed">{e.body}</p>
                   <div className="flex items-center gap-2 mt-2">
                     {e.priority === 'High' && <span className="text-[8px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded border border-rose-500/30">URGENT</span>}
                     {e.analysis?.threatLevel === 'CRITICAL' && <span className="text-[8px] bg-rose-900/50 text-white px-2 py-0.5 rounded border border-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]">THREAT DETECTED</span>}
                   </div>
                   {e.attachments && e.attachments.length > 0 && <Icons.Paperclip className="absolute right-12 top-4 w-3 h-3 text-slate-700" />}
                     <button aria-label="Summarize email" onClick={(evt) => handleSummarizeSingleEmail(e, evt)} className="absolute right-4 bottom-4 p-2 bg-slate-800/80 rounded-lg text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all shadow-xl backdrop-blur-sm"><Icons.Bot className="w-4 h-4" /></button>
                 </div>
               ))
             )}
             {filteredEmails.length === 0 && (
               <div className="flex flex-col items-center justify-center py-24 opacity-20">
                 <Icons.Inbox className="w-12 h-12 mb-4" />
                 <span className="text-[10px] uppercase tracking-[0.3em]">Folder Empty</span>
               </div>
             )}
           </div>
        </section>

        {(selectedId || selectedContactId || currentFolder === 'Calendar' || currentFolder === 'To Do List') && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-300">
             {selectedId ? <EmailDetailView email={selectedEmail!} onClose={() => setSelectedId(null)} onPreview={triggerPreview} onDownload={handleDownload} onDelete={handleDeleteEmail} /> : 
              selectedContactId ? <ContactView contact={selectedContact!} onClose={() => setSelectedContactId(null)} onSendMail={() => setIsComposeOpen(true)} onMessage={handleOpenAgentLee} emails={emails} /> :
              currentFolder === 'Calendar' ? <div className="flex-1 flex flex-col"><div className="p-4 border-b border-slate-800 shrink-0"><button aria-label="Back" onClick={() => setCurrentFolder('Inbox')} className="p-2 text-cyan-400 bg-slate-900 rounded-lg"><Icons.ArrowLeft /></button></div><div className="flex-1 overflow-y-auto"><CalendarSystem tasks={tasks} onAddTask={async (label, date) => {
                const newTask: TaskItem = { id: Math.random().toString(36).substring(7), label, date, time: '12:00', status: 'queued' };
                await mlAdapter.putFile("leemail/tasks/", `task_${newTask.id}`, newTask);
                setTasks(prev => [...prev, newTask]);
                agentRef.current?.pulse();
              }} /></div></div> :
              currentFolder === 'To Do List' ? <div className="flex-1 flex flex-col"><div className="p-4 border-b border-slate-800 shrink-0"><button aria-label="Back" onClick={() => setCurrentFolder('Inbox')} className="p-2 text-cyan-400 bg-slate-900 rounded-lg"><Icons.ArrowLeft /></button></div><div className="flex-1 overflow-y-auto"><TodoListView emails={emails} tasks={tasks} /></div></div> : null
             }
          </div>
        )}

        {/* File Previewer Overlay */}
        {previewFile && (
          <div className="fixed inset-0 z-[700] bg-black/95 backdrop-blur-3xl flex flex-col animate-in zoom-in-95 duration-200">
             <div className="h-14 border-b border-slate-800 flex items-center px-6 justify-between shrink-0">
               <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400">Email Preview: {previewFile.name}</span>
               <button aria-label="Close preview" onClick={() => setPreviewFile(null)} className="p-2 text-slate-500 hover:text-rose-400 transition-colors"><Icons.Plus className="rotate-45 w-5 h-5" /></button>
             </div>
             <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-hidden">
                <div className="w-full h-full max-w-4xl bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col items-center space-y-6 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-4 right-6 flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                      <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest">Agent Lee Analyzing...</span>
                   </div>
                   <div className="flex-1 w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40 border border-slate-800/50">
                     {previewFile.type.startsWith('image/') ? (
                       <img src={previewFile.dataUrl} alt="Preview" className="max-w-full max-h-full object-contain p-4" />
                     ) : (
                       <div className="flex flex-col items-center gap-4 text-slate-600">
                         <Icons.Paperclip className="w-20 h-20 opacity-20" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Encrypted Binary Data</span>
                       </div>
                     )}
                   </div>
                   <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
                        <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Metadata</div>
                        <div className="text-[12px] text-white font-mono break-all">{previewFile.name}</div>
                        <div className="text-[10px] text-slate-600 font-mono mt-1">{previewFile.type || 'unknown/stream'}</div>
                     </div>
                     <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-xl">
                        <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Integrity Check</div>
                        <div className="text-[11px] text-emerald-500 font-bold uppercase tracking-widest">PASS :: SHA-256 VERIFIED</div>
                     </div>
                   </div>
                   <div className="w-full flex gap-3">
                     <button onClick={() => handleDownload(previewFile.dataUrl, previewFile.name)} className="flex-1 bg-cyan-500 text-slate-950 h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)]">Download Data</button>
                     <button aria-label="Delete file" onClick={() => setPreviewFile(null)} className="p-4 bg-slate-800 text-rose-500 rounded-2xl active:scale-95"><Icons.Trash /></button>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Agent Panel Overlay */}
      <aside className={`fixed inset-0 z-[400] transition-all duration-300 ${isAgentPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
         <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAgentPanelOpen(false)} />
         <div className={`absolute top-0 right-0 h-full w-full bg-slate-900 border-l border-slate-800 transition-transform duration-300 transform ${isAgentPanelOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col shadow-2xl`}>
            <div className="h-[300px] relative bg-black border-b border-slate-800 shrink-0">
               <VoxelAgent ref={agentRef} className="w-full h-full" />
               <button aria-label="Close agent panel" onClick={() => setIsAgentPanelOpen(false)} className="absolute top-4 right-4 p-2.5 bg-slate-900/80 rounded-xl border border-slate-700 text-slate-400 z-10 hover:text-cyan-400 transition-all active:scale-90"><Icons.Plus className="rotate-45" /></button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
               <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  {selectedEmail && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <Icons.Shield className={selectedEmail.analysis?.threatLevel === 'CRITICAL' ? 'text-rose-500' : 'text-emerald-500'} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Security Analysis: {selectedEmail.analysis?.threatLevel}</span>
                      </div>
                      <div className="bg-slate-950/60 p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                        <div className="text-[9px] font-bold text-slate-600 uppercase mb-3 tracking-widest">Findings</div>
                        <p className="text-[13px] text-slate-200 italic font-sans leading-relaxed">{selectedEmail.analysis?.summary}</p>
                      </div>
                    </div>
                  )}
                  <div className="pt-8 border-t border-slate-800/60 space-y-5">
                     <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">OS Intelligence Log</div>
                     {agentHistory.map((m, i) => (
                       <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[85%] p-4 rounded-2xl text-[11px] font-sans border transition-all ${m.role === 'user' ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-100' : 'bg-slate-800/40 border-slate-800 text-slate-300'} ${m.type === 'finding' ? 'border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : ''}`}>{m.text}</div>
                       </div>
                     ))}
                     <div ref={chatBottomRef} />
                  </div>
               </div>
               <div className="p-5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-2xl flex gap-3">
                  <input aria-label="Agent command" type="text" value={agentChatText} onChange={e => setAgentChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAgentChat()} placeholder="Agent Command..." className="flex-1 bg-black border border-slate-800 rounded-2xl py-4 px-6 text-[12px] text-white focus:outline-none transition-all" />
                  <button aria-label="Send message" onClick={handleAgentChat} className="bg-cyan-500 text-slate-950 p-4 rounded-2xl active:scale-95 transition-all hover:bg-cyan-400"><Icons.Send className="w-5 h-5" /></button>
               </div>
            </div>
         </div>
      </aside>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-[500] flex flex-col bg-black animate-in slide-in-from-bottom-6 duration-300">
           <div className="h-14 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-900/60 shrink-0 shadow-xl">
             <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400 neon-text">New Transmission</span>
             <button aria-label="Close compose" onClick={() => setIsComposeOpen(false)} className="p-2 text-slate-500 bg-slate-800/50 rounded-lg active:scale-90"><Icons.Plus className="rotate-45" /></button>
           </div>
           <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-600 ml-1">Recipient Node</label>
                    <input aria-label="Recipient email" type="email" value={composeRecipient} onChange={e => setComposeRecipient(e.target.value)} placeholder="recipient@node.net" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-cyan-500 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-600 ml-1">Subject</label>
                <input aria-label="Subject" type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Transmission subject..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-cyan-500 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-600 ml-1">Body</label>
                <textarea aria-label="Body" rows={8} value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Enter message payload..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-cyan-500 outline-none resize-none font-sans transition-all" />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] font-bold uppercase text-slate-600 ml-1">Data Attachments</div>
                    <label aria-label="Attach files" className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-cyan-400 cursor-pointer active:scale-90 transition-all shadow-lg">
                    <Icons.Paperclip className="w-5 h-5" />
                    <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                  </label>
                </div>
                
                <div className="space-y-2">
                   {composeAttachments.map((a, i) => (
                     <div key={i} className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-xl animate-in slide-in-from-left-2">
                        <div className="flex items-center gap-3">
                          <Icons.Paperclip className="text-cyan-500" />
                          <span className="text-[11px] font-mono text-slate-300 truncate max-w-[150px]">{a.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button aria-label="Preview attachment" onClick={() => triggerPreview(a.dataUrl, a.name, a.type)} className="p-2 text-slate-400 hover:text-cyan-400 bg-slate-800 rounded-lg transition-all"><Icons.Eye /></button>
                          <button aria-label="Remove attachment" onClick={() => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-rose-500 hover:text-rose-400 bg-slate-800 rounded-lg transition-all"><Icons.Trash className="w-4 h-4" /></button>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
           </div>
           
           <div className="p-6 border-t border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={() => setIsLiveMail(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${!isLiveMail ? 'bg-slate-700 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>Regular Email</button>
                <button onClick={() => setIsLiveMail(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${isLiveMail ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-800 text-slate-500'}`}>Live Mail</button>
              </div>
              <button onClick={handleSendEmail} className="bg-cyan-500 text-slate-950 w-full h-16 font-bold rounded-2xl uppercase text-[11px] tracking-widest shadow-2xl hover:bg-cyan-400 active:scale-95 transition-all">Send {isLiveMail ? 'Live Mail' : 'Email'}</button>
           </div>
        </div>
      )}

      <footer className="h-10 border-t border-slate-800 bg-slate-900 flex items-center justify-between px-6 text-[9px] font-bold uppercase tracking-widest text-slate-600 shrink-0 z-[200]">
        <div className="flex items-center gap-2 text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" /><span>Agent Lee - Agentic Operating System</span></div>
        <div className="text-slate-800 font-mono opacity-50">Secure Sync // Port 443</div>
      </footer>
    </div>
  );
};

// --- Child Views ---
const CalendarSystem: React.FC<{ tasks: TaskItem[], onAddTask: (t: string, d: string) => void }> = ({ tasks, onAddTask }) => {
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [newTaskText, setNewTaskText] = useState('');
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = new Date(currentYear, currentMonthIdx).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const selectedDateStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const todaysTasks = tasks.filter(t => t.date === selectedDateStr);
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-sm mx-auto">
      <div className="text-center border-b border-slate-800 pb-6">
        <div className="text-[16px] font-bold text-white uppercase tracking-widest">Timeline Calendar</div>
        <div className="text-[12px] text-slate-400 mt-2 font-medium">{monthName}</div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => <div key={`${d}-${i}`} className="text-[9px] font-bold text-slate-700 text-center">{d}</div>)}
        {Array.from({length: 31}).map((_, i) => { const day = i + 1;
          const hasTask = tasks.some(t => t.date.endsWith(`-${String(day).padStart(2, '0')}`));
          return <div key={day} onClick={() => setSelectedDay(day)} className={`h-11 border border-slate-800 rounded-xl flex items-center justify-center text-[11px] font-bold relative transition-all ${selectedDay === day ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_#22d3ee]' : 'text-slate-500 hover:text-cyan-400'}`}>
            {day}{hasTask && selectedDay !== day && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_5px_#22d3ee]" />}
          </div>;
        })}
      </div>
      <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-2xl space-y-3">
        <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Mark Date..." className="w-full bg-black border border-slate-800 rounded-xl px-4 py-2 text-[11px] text-white outline-none focus:border-cyan-500 transition-all" />
        <button onClick={() => { if(newTaskText.trim()) { onAddTask(newTaskText, selectedDateStr); setNewTaskText(''); } }} className="w-full bg-cyan-500 text-slate-950 h-10 rounded-xl font-bold uppercase text-[9px] tracking-widest active:scale-95 transition-all">Add Task</button>
      </div>
      <div className="space-y-3">
        {todaysTasks.map(t => <div key={t.id} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-[12px] font-bold text-slate-300 shadow-xl">{t.label}</div>)}
      </div>
    </div>
  );
};

const TodoListView: React.FC<{ emails: Email[], tasks: TaskItem[] }> = ({ emails, tasks }) => {
  const emailActions = useMemo(() => emails.flatMap(e => e.analysis?.actionItems || []).filter((v, i, a) => a.indexOf(v) === i), [emails]);
  const allIncomplete = useMemo(() => [...tasks.filter(t => t.status !== 'completed').map(t => t.label), ...emailActions], [tasks, emailActions]);
  return (
    <div className="p-8 space-y-4 max-w-sm mx-auto">
      <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400 mb-6 text-center neon-text">Action Queue</div>
      {allIncomplete.map((t, i) => (
        <div key={i} className="flex items-center gap-6 bg-slate-900/30 p-6 rounded-3xl border border-slate-800 group transition-all cursor-pointer hover:border-cyan-500/40">
          <div className="w-6 h-6 border border-slate-700 rounded-lg group-hover:border-cyan-500 flex items-center justify-center"><div className="w-2 h-2 bg-cyan-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" /></div>
          <span className="text-[13px] text-slate-400 group-hover:text-slate-100 font-sans leading-relaxed">{t}</span>
        </div>
      ))}
      {allIncomplete.length === 0 && <div className="text-center py-12 text-slate-700 text-[10px] uppercase tracking-widest">Zero Pending Tasks</div>}
    </div>
  );
};

const EmailDetailView: React.FC<{ 
  email: Email, 
  onClose: () => void, 
  onPreview: (dataUrl: string, n: string, t: string) => void, 
  onDownload: (dataUrl: string, n: string) => void,
  onDelete: (id: string) => void 
}> = ({ email, onClose, onPreview, onDownload, onDelete }) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-black">
      <div className="h-14 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/60 shrink-0 shadow-lg">
      <button aria-label="Back" onClick={onClose} className="p-2 text-cyan-400 bg-slate-800/50 rounded-xl transition-all active:scale-90"><Icons.ArrowLeft /></button>
      <h2 className="text-[10px] font-bold uppercase truncate max-w-[180px] text-center neon-text">{email.subject}</h2>
      <button aria-label="Delete email" onClick={() => onDelete(email.id)} className="p-2 text-rose-500 bg-slate-800/50 rounded-xl hover:bg-rose-500/10 transition-all"><Icons.Trash /></button>
    </div>
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20 custom-scrollbar">
      <div className="flex items-center gap-5 mb-8 pb-6 border-b border-slate-800/30">
        <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-2xl font-bold text-cyan-400 shadow-2xl">{email.sender[0]}</div>
        <div className="flex-1"><div className="text-[14px] font-bold text-white uppercase tracking-widest">{email.sender}</div><div className="text-[11px] text-slate-600 font-mono">{email.senderEmail}</div></div>
      </div>
      <div className="text-[14px] text-slate-300 leading-relaxed font-sans whitespace-pre-wrap mb-12">{email.body}</div>
      {email.attachments && email.attachments.length > 0 && (
        <div className="space-y-4">
           <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">Data Stream Attachments</div>
           {email.attachments.map((att, i) => (
            <div key={i} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-cyan-500/20 transition-all shadow-xl">
               <div className="flex items-center gap-4">
                 <Icons.Paperclip className="text-slate-600 group-hover:text-cyan-500 transition-colors" />
                 <span className="text-[11px] font-mono text-slate-300 truncate max-w-[200px]">{att.name}</span>
               </div>
               <div className="flex gap-2">
                 <button aria-label="Preview attachment" onClick={() => onPreview(att.dataUrl, att.name, att.type)} className="p-2 text-slate-500 hover:text-cyan-400 bg-slate-800 rounded-lg transition-colors shadow-lg"><Icons.Eye /></button>
                 <button aria-label="Download attachment" onClick={() => onDownload(att.dataUrl, att.name)} className="p-2 text-cyan-400 hover:bg-cyan-500/10 bg-slate-800 rounded-lg transition-colors shadow-lg"><Icons.Download /></button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="p-5 border-t border-slate-800 bg-slate-900/80 backdrop-blur-xl flex gap-3 shadow-2xl">
       <button onClick={onClose} className="flex-1 bg-cyan-500 text-slate-950 h-14 rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all hover:bg-cyan-400">Acknowledge Node</button>
    </div>
  </div>
);

const ContactView: React.FC<{ contact: Contact, onClose: () => void, onSendMail: () => void, onMessage: () => void, emails: Email[] }> = ({ contact, onClose, onSendMail, onMessage, emails }) => {
  const history = useMemo(() => emails.filter(e => e.senderEmail === contact.email), [emails, contact]);
  return (
    <div className="flex-1 flex flex-col h-full bg-black">
      <div className="h-14 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/60 shrink-0 shadow-lg">
        <button aria-label="Back" onClick={onClose} className="p-2 text-cyan-400 bg-slate-800/50 rounded-xl active:scale-90 transition-all"><Icons.ArrowLeft /></button>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Node Identification</span>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="space-y-10 flex flex-col items-center max-w-sm mx-auto">
             <div className="w-28 h-28 bg-slate-800 border-2 border-cyan-500/20 rounded-[2.5rem] flex items-center justify-center text-6xl font-bold text-cyan-400 shadow-2xl">{contact.name[0]}</div>
             <div className="text-center space-y-2">
               <div className="text-2xl font-bold uppercase text-white tracking-tight">{contact.name}</div>
               <div className="text-[12px] text-slate-500 font-mono uppercase tracking-[0.2em]">{contact.email}</div>
               <div className="text-[10px] font-bold uppercase mt-4 px-3 py-1 rounded-full border border-emerald-500/20 text-emerald-500 bg-emerald-500/5">{contact.status}</div>
             </div>
             <div className="grid grid-cols-2 gap-4 w-full">
                <button onClick={onSendMail} className="bg-cyan-500 text-slate-950 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all hover:bg-cyan-400"><Icons.Send /> Send Email</button>
                <button onClick={onMessage} className="bg-slate-800 text-cyan-400 p-4 rounded-2xl border border-cyan-500/20 flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"><Icons.Message /> Consult Lee</button>
             </div>
             <div className="w-full bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-4 shadow-inner">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">Node Profile</div>
                <p className="text-sm text-slate-300 italic font-sans leading-relaxed">"{contact.bio}"</p>
             </div>
          </div>
      </div>
    </div>
  );
};

const NavItem: React.FC<{ label: string, icon: React.ReactNode, active?: boolean, onClick: () => void, count?: number }> = ({ label, icon, active, onClick, count }) => (
  <div onClick={onClick} className={`flex items-center justify-between px-4 py-4 rounded-2xl cursor-pointer transition-all border ${active ? 'bg-slate-800 text-cyan-400 border-cyan-500/20 shadow-xl' : 'text-slate-400 border-transparent hover:bg-slate-800/60'}`}>
    <div className="flex items-center gap-5">{icon}<span className="text-[12px] font-bold uppercase tracking-[0.1em]">{label}</span></div>
    {count !== undefined && <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 text-slate-500">{count}</span>}
  </div>
);

const NavGroup: React.FC<{ label: string, icon: React.ReactNode, expanded: boolean, children?: React.ReactNode, active?: boolean, onClick?: () => void, count?: number }> = ({ label, icon, expanded, children, active, onClick, count }) => (
  <div className="space-y-1.5">
    <div onClick={onClick} className={`flex items-center justify-between px-4 py-4 rounded-2xl cursor-pointer transition-all border ${active ? 'bg-slate-800 text-cyan-400 border-cyan-500/10' : 'text-slate-400 border-transparent hover:bg-slate-800/40'}`}>
      <div className="flex items-center gap-5">{icon}<span className="text-[12px] font-bold uppercase tracking-[0.1em]">{label}</span></div>
      <div className="flex items-center gap-2">
        {count !== undefined && <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 text-slate-500">{count}</span>}
        <Icons.ChevronDown className={`transition-transform duration-300 ${expanded ? '' : '-rotate-90'}`} />
      </div>
    </div>
    {expanded && children && <div className="pl-6 space-y-1.5 mt-1.5 animate-in slide-in-from-top-4 duration-300">{children}</div>}
  </div>
);

const NavSubItem: React.FC<{ label: string, active: boolean, onClick: () => void, count?: number }> = ({ label, active, onClick, count }) => (
  <div onClick={onClick} className={`px-5 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest flex justify-between items-center cursor-pointer transition-all ${active ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/20'}`}>
    <span>{label}</span>
    {count !== undefined && <span className={`text-[9px] ${active ? 'text-cyan-400' : 'text-slate-700'}`}>{count}</span>}
  </div>
);

export default EmailCenter;
