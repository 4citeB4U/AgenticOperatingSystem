
const fs = require('fs');
const path = require('path');
// Patch src/transformers.js (and any other static import)
const srcTransformers = path.join(__dirname, '../node_modules/@xenova/transformers/src/transformers.js');
patchFile(
  srcTransformers,
  `import * as ONNX_WEB from "onnxruntime-web";`,
  `// PATCH: Remove static import of onnxruntime-web for Vite compatibility\nlet ONNX_WEB;`,
  'remove static import (src/transformers.js)'
);

function patchFile(filePath, find, replace, description) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch] File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(replace.trim())) {
    console.log(`[patch] Already patched: ${filePath}`);
    return;
  }
  const newContent = content.replace(find, replace);
  if (newContent === content) {
    console.warn(`[patch] Pattern not found in: ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`[patch] Patched: ${filePath} (${description})`);
}

// Patch src/backends/onnx.js
const srcOnnx = path.join(__dirname, '../node_modules/@xenova/transformers/src/backends/onnx.js');
patchFile(
  srcOnnx,
  `import * as ONNX_NODE from 'onnxruntime-node';\nimport * as ONNX_WEB from 'onnxruntime-web';`,
  `\nlet ONNX_NODE;\nlet ONNX_WEB;`,
  'remove static imports (src)'
);
patchFile(
  srcOnnx,
  `if (typeof process !== 'undefined' && process?.release?.name === 'node') {\n    // Running in a node-like environment.\n    ONNX = ONNX_NODE.default ?? ONNX_NODE;\n\n    // Add \`cpu\` execution provider, with higher precedence that \`wasm\`.\n    executionProviders.unshift('cpu');\n\n} else {\n    // Running in a browser-environment\n    ONNX = ONNX_WEB.default ?? ONNX_WEB;\n\n    // SIMD for WebAssembly does not operate correctly in some recent versions of iOS (16.4.x).\n    // As a temporary fix, we disable it for now.\n    // For more information, see: https://github.com/microsoft/onnxruntime/issues/15644\n    const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad).+16_4.+AppleWebKit/.test(navigator.userAgent);\n    if (isIOS) {\n        ONNX.env.wasm.simd = false;\n    }\n}`,
  `if (typeof process !== 'undefined' && process?.release?.name === 'node') {\n    // Running in a node-like environment.\n    ONNX_NODE = await import('onnxruntime-node');\n    ONNX = ONNX_NODE.default ?? ONNX_NODE;\n    executionProviders.unshift('cpu');\n} else {\n    // Running in a browser-environment\n    const ortPath = '/onnx/ort.wasm.mjs';\n    ONNX_WEB = await import(/* @vite-ignore */ ortPath);\n    ONNX = ONNX_WEB.default ?? ONNX_WEB;\n    const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad).+16_4.+AppleWebKit/.test(navigator.userAgent);\n    if (isIOS) {\n        ONNX.env.wasm.simd = false;\n    }\n}`,
  'patch dynamic import (src)'
);

// Patch dist/transformers.js
const distOnnx = path.join(__dirname, '../node_modules/@xenova/transformers/dist/transformers.js');
patchFile(
  distOnnx,
  `/* harmony import */ var onnxruntime_web__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! onnxruntime-web */ \"./node_modules/onnxruntime-web/dist/ort-web.min.js\");`,
  `// PATCH: Remove static import of onnxruntime-web for Vite compatibility\nvar onnxruntime_web__WEBPACK_IMPORTED_MODULE_1__ = null;`,
  'remove static import (dist)'
);
patchFile(
  distOnnx,
  `if (typeof process !== 'undefined' && process?.release?.name === 'node') {\n    // Running in a node-like environment.\n    ONNX = onnxruntime_node__WEBPACK_IMPORTED_MODULE_0__ ?? /*#__PURE__*/ (onnxruntime_node__WEBPACK_IMPORTED_MODULE_0___namespace_cache || (onnxruntime_node__WEBPACK_IMPORTED_MODULE_0___namespace_cache = __webpack_require__.t(onnxruntime_node__WEBPACK_IMPORTED_MODULE_0__, 2)));\n\n    // Add \`cpu\` execution provider, with higher precedence that \`wasm\`.\n    executionProviders.unshift('cpu');\n\n} else {\n    // Running in a browser-environment\n    ONNX = onnxruntime_web__WEBPACK_IMPORTED_MODULE_1__ ?? /*#__PURE__*/ (onnxruntime_web__WEBPACK_IMPORTED_MODULE_1___namespace_cache || (onnxruntime_web__WEBPACK_IMPORTED_MODULE_1___namespace_cache = __webpack_require__.t(onnxruntime_web__WEBPACK_IMPORTED_MODULE_1__, 2)));\n\n    // SIMD for WebAssembly does not operate correctly in some recent versions of iOS (16.4.x).\n    // As a temporary fix, we disable it for now.\n    // For more information, see: https://github.com/microsoft/onnxruntime/issues/15644\n    const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad).+16_4.+AppleWebKit/.test(navigator.userAgent);\n    if (isIOS) {\n        ONNX.env.wasm.simd = false;\n    }\n}`,
  `if (typeof process !== 'undefined' && process?.release?.name === 'node') {\n    // Running in a node-like environment.\n    ONNX = onnxruntime_node__WEBPACK_IMPORTED_MODULE_0__ ?? /*#__PURE__*/ (onnxruntime_node__WEBPACK_IMPORTED_MODULE_0___namespace_cache || (onnxruntime_node__WEBPACK_IMPORTED_MODULE_0___namespace_cache = __webpack_require__.t(onnxruntime_node__WEBPACK_IMPORTED_MODULE_0__, 2)));\n    executionProviders.unshift('cpu');\n} else {\n    // Running in a browser-environment\n    // PATCH: Use dynamic import for onnxruntime-web for Vite compatibility\n    var ortPath = '/onnx/ort.wasm.mjs';\n    var ONNX_WEB_PROMISE = import(/* @vite-ignore */ ortPath);\n    ONNX_WEB_PROMISE.then(function(ONNX_WEB) {\n        ONNX = ONNX_WEB.default ?? ONNX_WEB;\n        var isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad).+16_4.+AppleWebKit/.test(navigator.userAgent);\n        if (isIOS) {\n            ONNX.env.wasm.simd = false;\n        }\n    });\n}`,
  'patch dynamic import (dist)'
);

console.log('[patch] @xenova/transformers patched for Vite/ORT dynamic import.');
