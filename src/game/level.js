import { valueNoise2D } from "../../rng.js";
import { clamp } from "./math.js";

export function getNoiseThresholdForMaxFill({ cols, rows, seed, noiseScale, maxFillRatio }) {
  const count = Math.max(1, (cols | 0) * (rows | 0));
  const values = new Float32Array(count);
  let i = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      values[i++] = clamp(valueNoise2D(col * noiseScale, row * noiseScale, seed), 0, 1);
    }
  }

  values.sort();
  const idx = clamp(Math.ceil(values.length * (1 - maxFillRatio)), 0, values.length - 1);
  return values[idx];
}

export function countAliveBlocks(grid) {
  let alive = 0;
  const hp = grid.hp;
  for (let i = 0; i < hp.length; i++) if (hp[i] > 0) alive++;
  return alive;
}
