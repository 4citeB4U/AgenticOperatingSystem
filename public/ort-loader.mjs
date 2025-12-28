// Loader for ONNX Runtime ESM (placed in /public so Vite won't transform it)
import * as __ORT__ from '/models/onnx/ort.wasm.mjs';
// Expose for runtime
window.__ORT__ = __ORT__;
console.info('[ORT Loader] loaded ORT from /models/onnx/ort.wasm.mjs');
