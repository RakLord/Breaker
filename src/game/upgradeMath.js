import { clamp } from "./math.js";

const CRIT_MAX_CHANCE = 0.5;
const CRIT_PER_LEVEL = 0.02;
const EXEC_MAX_RATIO = 0.5;
const EXEC_PER_LEVEL = 0.05;

export function getPieceCountForLevel(level) {
  return clamp(1 + Math.max(0, level | 0), 1, 9);
}

export function getCritChanceForLevel(level) {
  return clamp(Math.max(0, level | 0) * CRIT_PER_LEVEL, 0, CRIT_MAX_CHANCE);
}

export function getExecuteRatioForLevel(level) {
  return clamp(Math.max(0, level | 0) * EXEC_PER_LEVEL, 0, EXEC_MAX_RATIO);
}

export function getCritLevelCap() {
  return Math.ceil(CRIT_MAX_CHANCE / CRIT_PER_LEVEL);
}

export function getExecuteLevelCap() {
  return Math.ceil(EXEC_MAX_RATIO / EXEC_PER_LEVEL);
}
