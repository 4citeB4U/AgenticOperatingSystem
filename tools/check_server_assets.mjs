import fs from "node:fs/promises";
import path from "node:path";
import { enforceCIGuard } from "./_ci_guard.mjs";
enforceCIGuard();

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "public", "models", "MODEL_MANIFEST.json");
const REPORT = path.join(ROOT, "reports", "model-server-check.json");

const baseArg = process.argv[2];
if (!baseArg) { console.error("Usage: node tools/check_server_assets.mjs http://localhost:5173/models/"); process.exit(2); }
const base = baseArg.endsWith("/") ? baseArg : (baseArg + "/");

const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
let overall = "PASS";
const checks = [];

for (const m of (manifest.models || [])) {
  for (const epRaw of (m.entrypoints || [])) {
    const ep = epRaw.replace(/^\/?models\//,"").replace(/^\//,"");
    const url = base + ep;
    const res = await fetch(url, { method: "GET" });
    checks.push({ url, httpStatus: res.status, status: res.ok ? "PASS" : "FAIL" });
    if (!res.ok) overall = "FAIL";
  }
}

await fs.mkdir(path.dirname(REPORT), { recursive: true });
await fs.writeFile(REPORT, JSON.stringify({ generated_at: new Date().toISOString(), overall, base, checks }, null, 2), "utf8");
console.log("[OK] Wrote:", REPORT);
if (overall !== "PASS") process.exit(1);
