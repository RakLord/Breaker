import { clamp } from "./math.js";

export function getPieceCountForLevel(level) {
  return clamp(1 + Math.max(0, level | 0), 1, 9);
}

export function getCritChanceForLevel(level) {
  return clamp(Math.max(0, level | 0) * 0.02, 0, 0.5);
}

export function getExecuteRatioForLevel(level) {
  return clamp(Math.max(0, level | 0) * 0.05, 0, 0.5);
}
