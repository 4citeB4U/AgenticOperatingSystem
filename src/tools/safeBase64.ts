/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: UTIL.SECURE.BASE64.HANDLER
   REGION: 🟠 UTIL
   VERSION: 1.0.0
   ============================================================================
   safeBase64.ts

   DISCOVERY_PIPELINE:
     Voice → Intent → Location → Vertical → Ranking → Render

   SPDX-License-Identifier: MIT
   ============================================================================ */

export function isBase64String(s: string) {
  if (typeof s !== 'string') return false;
  // Quick length sanity
  if (s.length === 0 || s.length % 4 !== 0) return false;
  // Allow A-Z a-z 0-9 + / = and newlines/spaces
  return /^[A-Za-z0-9+/=\r\n]+$/.test(s);
}

export function safeAtob(s: string, maxBytes = 10 * 1024 * 1024): string {
  if (!isBase64String(s)) throw new Error('Invalid base64 string');
  // Remove whitespace
  const cleaned = s.replace(/\s+/g, '');
  // Decode safely
  try {
    // Quick size check: base64 -> approx 3/4 bytes
    const approxBytes = Math.floor((cleaned.length * 3) / 4);
    if (approxBytes > maxBytes) throw new Error('Decoded data exceeds allowed size');
    return atob(cleaned);
  } catch (e) {
    throw new Error('Base64 decode failed');
  }
}

export function safeBtoa(s: string): string {
  try {
    return btoa(s);
  } catch (e) {
    throw new Error('Base64 encode failed');
  }
}
