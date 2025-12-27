/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.APP.COMPONENT.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   dump_line.js
   
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

const fs = require('fs'); const lineNum = parseInt(process.argv[2] || '1',10); const s = fs.readFileSync('src/App.tsx','utf8'); const lines = s.split(/\r?\n/); const line = lines[lineNum-1] || ''; console.log(line); console.log('CHARCODES:', Array.from(line).map(c=>c.charCodeAt(0)).join(','));