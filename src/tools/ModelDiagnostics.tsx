/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.MODELDIAGNOSTICS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   ModelDiagnostics.tsx
   
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

import { useEffect, useState } from 'react';
/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UI.COMPONENT.MODELDIAGNOSTICS.MAIN
   REGION: 🟢 CORE
   VERSION: 1.0.0
   ============================================================================
   ModelDiagnostics.tsx
   
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

import { CORE_REGISTRY } from '../coreRegistry';
import './ModelDiagnostics.css';

type CheckResult = { file: string; ok: boolean; status: number | string };
type ModelCheck = { key: string; base: string; checks: CheckResult[]; ok: boolean };

const head = async (url: string) => {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return { file: url, ok: r.ok, status: r.status } as CheckResult;
  } catch (e: any) {
    return { file: url, ok: false, status: e?.message || String(e) } as CheckResult;
  }
};

const fileExists = async (base: string, file: string): Promise<CheckResult> => {
  const url = `${base}/${file}`.replace(/\/+/g, '/');
  let r = await head(url);
  if (r.ok) return { file, ok: true, status: r.status };
  try {
    const g = await fetch(url, { method: 'GET', cache: 'no-store' });
    return { file, ok: g.ok, status: g.status };
  } catch (e: any) {
    return { file, ok: false, status: e?.message || String(e) };
  }
};

const ModelDiagnostics = ({ onClose }: { onClose: () => void }) => {
  const [results, setResults] = useState<ModelCheck[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setRunning(true);
      const rows: ModelCheck[] = [];
      for (const key of Object.keys(CORE_REGISTRY)) {
        const cfg: any = (CORE_REGISTRY as any)[key];
        const base = cfg.repo || cfg.remoteRepo || '';
        const checks: CheckResult[] = [];

        if (!base) {
          rows.push({ key, base, checks: [{ file: 'none', ok: false, status: 'no repo' }], ok: false });
          continue;
        }

        if (cfg.type === 'vision') {
          const files = ['onnx/vision_encoder.onnx', 'onnx/embed_tokens.onnx', 'onnx/decoder_model_merged.onnx', 'config.json'];
          for (const f of files) {
            const r = await fileExists(base, f);
            checks.push(r);
          }
          const t1 = await fileExists(base, 'tokenizer.json');
          const t2 = await fileExists(base, 'tokenizer.model');
          checks.push(t1.ok ? t1 : t2);
        } else if (cfg.type === 'llm' || cfg.type === 'embed') {
          const candidates = ['onnx/model.onnx', 'model.onnx', 'config.json'];
          for (const f of candidates) {
            const r = await fileExists(base, f);
            checks.push(r);
          }
          const t1 = await fileExists(base, 'tokenizer.json');
          const t2 = await fileExists(base, 'tokenizer.model');
          checks.push(t1.ok ? t1 : t2);
        } else {
          const r = await fileExists(base, 'config.json');
          checks.push(r);
        }

        const ok = checks.every(c => c.ok);
        rows.push({ key, base, checks, ok });
      }

      if (mounted) {
        setResults(rows);
        setRunning(false);
      }
    };

    run().catch((e) => { console.error('ModelDiagnostics error', e); if (mounted) setRunning(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="model-diag">
      <div className="diag-header">
        <h3>Model Diagnostics</h3>
        <button onClick={onClose}>Close</button>
      </div>
      {running && <div>Running checks...</div>}
      {!running && results.length === 0 && <div>No models detected.</div>}
      <div>
        {results.map(r => (
          <div key={r.key} className="diag-row">
            <div className="diag-key">{r.key} — {r.base}</div>
            <div className="checks">
              {r.checks.map(c => (
                <div key={c.file} className={`check ${c.ok ? 'ok' : 'missing'}`}>
                  <div className="file">{c.file}</div>
                  <div className="status">{String(c.status)}</div>
                </div>
              ))}
            </div>
            <div className={`result ${r.ok ? 'ok' : 'missing'}`}>{r.ok ? 'OK' : 'MISSING FILES'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelDiagnostics;
