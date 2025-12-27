export async function runFetchSmoke({ modelId, maxFiles = 6 }) {
  const r = await fetch("/models/MODEL_MANIFEST.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Missing /models/MODEL_MANIFEST.json");
  const manifest = await r.json();
  const model = (manifest.models || []).find(m => m.id === modelId);
  if (!model) throw new Error(`Model not in manifest: ${modelId}`);

  const eps = (model.entrypoints || []).slice(0, maxFiles);
  const results = [];
  for (const raw of eps) {
    const ep = raw.replace(/^\/?models\//, "").replace(/^\//, "");
    const url = "/models/" + ep;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch ${res.status} ${url}`);
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength === 0) throw new Error(`Zero bytes ${url}`);
    results.push({ url, bytes: buf.byteLength, contentType: res.headers.get("content-type") || "" });
  }
  return { modelId, fetched: results.length, results };
}
