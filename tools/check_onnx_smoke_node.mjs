import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { enforceCIGuard } from "./_ci_guard.mjs";
enforceCIGuard();

const require = createRequire(import.meta.url);
const ort = require("onnxruntime-node");

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "public", "models", "MODEL_MANIFEST.json");
const REPORT = path.join(ROOT, "reports", "model-smoke-node.json");

function sha256(buf){ return crypto.createHash("sha256").update(buf).digest("hex"); }

const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
let overall = "PASS";
const results = [];

for (const m of (manifest.models || [])) {
  const r = { id: m.id, status: "PASS", checks: [] };
  for (const epRaw of (m.entrypoints || [])) {
    const ep = epRaw.replace(/^\/?models\//,"").replace(/^\//,"");
    const abs = path.join(ROOT, "public", "models", ep.replaceAll("/", path.sep));
    const c = { file: `public/models/${ep}` };

    try {
      const buf = await fs.readFile(abs);
      c.bytes = buf.byteLength;
      c.sha256 = sha256(buf);
      if (buf.byteLength === 0) throw new Error("zero bytes");

      const t0 = Date.now();
      await ort.InferenceSession.create(abs);
      c.loadTimeMs = Date.now() - t0;
      c.status = "PASS";
    } catch (e) {
      c.status = "FAIL";
      c.error = String(e?.message || e);
      r.status = "FAIL";
      overall = "FAIL";
    }
    r.checks.push(c);
  }
  results.push(r);
}

await fs.mkdir(path.dirname(REPORT), { recursive: true });
await fs.writeFile(REPORT, JSON.stringify({ generated_at: new Date().toISOString(), overall, results }, null, 2), "utf8");
console.log("[OK] Wrote:", REPORT);
if (overall !== "PASS") process.exit(1);
