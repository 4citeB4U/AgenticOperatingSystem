const urls = [
  'http://localhost:3001/models/qwen2.5-0.5b-instruct/config.json',
  'http://localhost:3001/models/qwen2.5-0.5b-instruct/onnx/model.onnx',
  'http://localhost:3001/onnx/ort-wasm-simd-threaded.wasm'
];
for (const u of urls) {
  try {
    const res = await fetch(u);
    console.log(u, res.status, res.headers.get('content-type'));
    if (res.ok) {
      const len = Number(res.headers.get('content-length')) || (await res.arrayBuffer()).byteLength;
      console.log('  length:', len);
    } else {
      const text = await res.text().then(t => t.slice(0,200));
      console.log('  body-preview:', text ? text.replace(/\n/g,' ') : '<empty>');
    }
  } catch (e) {
    console.log(u, 'ERROR', e.message);
  }
}
