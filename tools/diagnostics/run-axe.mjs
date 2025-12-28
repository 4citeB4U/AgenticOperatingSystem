import fs from 'fs';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3000';
const outPathArg = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    // Load axe-core from CDN
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.1/axe.min.js' });
    const results = await page.evaluate(async () => await window.axe.run());
    const json = JSON.stringify(results, null, 2);
    console.log(json);
    if (outPathArg) fs.writeFileSync(outPathArg, json);
  } finally {
    await browser.close();
  }
})();
