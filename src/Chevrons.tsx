/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.CHEVRONS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   Chevrons.tsx
   
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

import React from 'react';
import './Chevrons.css';
import { MODEL_REGISTRY } from './tools/modelRegistry';

type ChevronProps = {
  // progress values 0..100 for each model role key
  progress?: Partial<Record<keyof typeof MODEL_REGISTRY, number>>;
};

// Render pyramidal chevrons (two triangular halves) per model role.
export const Chevrons: React.FC<ChevronProps> = ({ progress = {} }) => {
  const roles = Object.keys(MODEL_REGISTRY) as (keyof typeof MODEL_REGISTRY)[];

  return (
    <div className="chevrons">
      {roles.map((r) => {
        const info = MODEL_REGISTRY[r];
        const p = Math.max(0, Math.min(100, progress[r] ?? 0));
        const state = p === 100 ? 'closed' : p >= 80 ? 'almost' : 'open';

        return (
          <div key={r} className={`chevron ${state}`}>
            <svg className="chevron-svg" width="48" height="56" viewBox="0 0 48 56" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id={`g-${r}`} x1="0" x2="1">
                  <stop offset="0%" stopColor="#FFD36B" />
                  <stop offset="100%" stopColor="#FFB400" />
                </linearGradient>
                <filter id={`shadow-${r}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#b37e00" floodOpacity="0.6" />
                </filter>
              </defs>
              {/* Back/base triangle (reveals when closed to make larger pyramid) */}
              <g className="base-triangle" filter={`url(#shadow-${r})`}>
                <path d="M4 36 L44 36 L24 6 Z" fill="#3b2a05" opacity="0.08" />
                <path d="M6 36 L42 36 L24 8 Z" fill={`url(#g-${r})`} opacity="0" className="base-fill" />
              </g>

              {/* Top half (tip pointing up) */}
              <g className="half top" filter={`url(#shadow-${r})`}>
                <path d="M24 6 L6 30 L42 30 Z" fill={`url(#g-${r})`} stroke="#b37f00" strokeWidth="1" />
              </g>

              {/* Bottom half (tip pointing down) - moves down when open */}
              <g className="half bottom" filter={`url(#shadow-${r})`}>
                <path d="M6 30 L42 30 L24 50 Z" fill={`url(#g-${r})`} stroke="#b37f00" strokeWidth="1" />
              </g>

              {/* Base / indicator ring */}
              <circle className={`indicator`} cx="24" cy="52" r="4" stroke="#b37f00" strokeWidth="1" />
            </svg>
            <div className="chevron-label">{info.localFolder}</div>
            <div className="chevron-sub">{r}</div>
          </div>
        );
      })}
    </div>
  );
};

export default Chevrons;
