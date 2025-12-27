/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   polyfills.ts
   
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

// REMOVED: import { Buffer } from 'buffer'; 
// The Vite plugin injects Buffer globally. Importing it explicitly can cause resolution errors if the package is missing.

import Long from 'long';

if (typeof window !== 'undefined') {
  
  if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
  }

  if (typeof (window as any).Long === 'undefined') {
    (window as any).Long = Long;
  }
  
  // Note: window.Buffer is handled by vite-plugin-node-polyfills
}

export {};