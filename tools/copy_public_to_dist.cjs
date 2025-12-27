const fs = require('fs');
const path = require('path');
const src = path.resolve(__dirname, '..', 'public', 'onnx');
const dest = path.resolve(__dirname, '..', 'dist', 'onnx');

if (!fs.existsSync(src)) {
  console.error('Source does not exist:', src);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
for (const f of fs.readdirSync(src)) {
  const s = path.join(src, f);
  const d = path.join(dest, f);
  fs.copyFileSync(s, d);
  console.log('Copied', f);
}
console.log('Done.');
