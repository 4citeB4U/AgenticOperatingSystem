import fs from "node:fs/promises";
import path from "node:path";
import { enforceCIGuard } from "./_ci_guard.mjs";
enforceCIGuard();

const ROOT = process.cwd();
const MODELS_DIR = path.join(ROOT, "public", "models");
const OUT = path.join(MODELS_DIR, "MODEL_MANIFEST.generated.json");

async function walk(dir) {
  const out = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}
function relFromModels(abs) {
  return abs.split(path.join("public","models")+path.sep).join("").replaceAll("\\","/");
}

const modelFolders = (await fs.readdir(MODELS_DIR, { withFileTypes: true }))
  .filter(d => d.isDirectory())
  .map(d => d.name);

const models = [];
for (const folder of modelFolders) {
  const root = path.join(MODELS_DIR, folder);
  const files = await walk(root);
  const entrypoints = files.filter(f => f.toLowerCase().endsWith(".onnx"))
    .map(relFromModels).sort((a,b)=>a.length-b.length);

  models.push({ id: folder, folder, base_url: `/models/${folder}/`, entrypoints });
}

await fs.writeFile(OUT, JSON.stringify({ generated_at: new Date().toISOString(), models }, null, 2), "utf8");
console.log("[OK] Wrote:", OUT);
