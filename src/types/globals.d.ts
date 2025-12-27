// Auto-generated project-wide ambient declarations to silence third-party module typing gaps
declare module 'three/examples/jsm/postprocessing/EffectComposer.js';
declare module 'three/examples/jsm/postprocessing/RenderPass.js';
declare module 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
declare module 'three/examples/jsm/controls/OrbitControls.js';
declare module 'three/examples/jsm/controls/OrbitControls';
declare module 'three/examples/jsm/postprocessing/EffectComposer';
declare module 'three/examples/jsm/postprocessing/RenderPass';
declare module 'three/examples/jsm/postprocessing/UnrealBloomPass';

// Allow importing some CDN-shimmed modules without types (safety: falls back to any)
// declare module 'onnxruntime-web'; // (removed: all ORT loading is via ortBootstrap)

// Minimal global shims used across the app to avoid eager runtime imports
declare const env: any;
declare function pipeline(...args: any[]): any;

