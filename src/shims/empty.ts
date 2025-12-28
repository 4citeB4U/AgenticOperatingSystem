/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   empty.ts
   
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

// Simple shim for Node built-ins in browser build
// Export a CommonJS-compatible empty object so libraries that
// check `Object.keys(fs)` or `Object.keys(path)` do not receive
// `undefined` or a module wrapper with only a `default` key.
const EMPTY: any = Object.create(null);
export default EMPTY;
try { (module as any).exports = EMPTY; } catch { /* ignore in ESM-only runtimes */ }
