export function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2DToUnitFloat(x, y, seed = 0) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function valueNoise2D(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const v00 = hash2DToUnitFloat(x0, y0, seed);
  const v10 = hash2DToUnitFloat(x1, y0, seed);
  const v01 = hash2DToUnitFloat(x0, y1, seed);
  const v11 = hash2DToUnitFloat(x1, y1, seed);

  const ix0 = lerp(v00, v10, sx);
  const ix1 = lerp(v01, v11, sx);
  return lerp(ix0, ix1, sy);
}

export function parseSeedToUint32(seedText) {
  if (!seedText) return (Math.random() * 2 ** 32) >>> 0;
  const s = String(seedText);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

