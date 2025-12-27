import fs from "node:fs/promises";
import path from "node:path";
import { enforceCIGuard } from "./_ci_guard.mjs";
enforceCIGuard();

const ROOT = process.cwd();
const REPORT = path.join(ROOT, "reports", "model-browser-smoke.json");

const base = process.argv[2];
if (!base) { console.error("Usage: node tools/check_browser_smoke_playwright.mjs http://localhost:5173"); process.exit(2); }

const { chromium } = await import("playwright");

const pages = [




















if (overall !== "PASS") process.exit(1);await browser.close();console.log("[OK] Wrote:", REPORT);await fs.writeFile(REPORT, JSON.stringify({ generated_at: new Date().toISOString(), overall, base, runs }, null, 2), "utf8");await fs.mkdir(path.dirname(REPORT), { recursive: true });
  runs.push(run);
  await page.close();
}
  run.ok = run.console.some(x => x.text.includes(p.ok));
  if (!run.ok || run.failedRequests.length || run.pageErrors.length) overall = "FAIL";
  await page.goto(p.url, { waitUntil: "networkidle" });
  page.on("pageerror", e => run.pageErrors.push(String(e)));
  page.on("requestfailed", r => run.failedRequests.push({ url: r.url(), error: r.failure()?.errorText || "requestfailed" }));
  page.on("response", r => { if (r.status() >= 400) run.failedRequests.push({ url: r.url(), error: "HTTP_" + r.status() }); });
  page.on("console", m => run.console.push({ type: m.type(), text: m.text() }));for (const p of pages) {
  const run = { name: p.name, url: p.url, ok: false, failedRequests: [], pageErrors: [], console: [] };
  const page = await ctx.newPage();const runs = [];let overall = "PASS";const ctx = await browser.newContext();const browser = await chromium.launch();  { name: "vision", url: base + "/smoke/vision-smoke.html", ok: "SMOKE_OK:VIT" },
  { name: "llm",   url: base + "/smoke/llm-smoke.html",   ok: "SMOKE_OK:QWEN" },
  { name: "sd",    url: base + "/smoke/sd-smoke.html",    ok: "SMOKE_OK:SD_FETCH" }
];