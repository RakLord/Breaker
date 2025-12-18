import { D } from "./numbers.js";

const SAVE_KEY = "breaker_player_save_v1";
const SAVE_VERSION = 1;

export function createDefaultPlayer() {
  return {
    version: SAVE_VERSION,
    points: "0",
    upgrades: {
      damageLevel: 0,
      speedLevel: 0,
    },
    map: {
      pattern: "noise",
      seed: null,
    },
    game: {
      balls: [],
    },
    meta: {
      createdAt: Date.now(),
      lastSavedAt: null,
    },
  };
}

export function normalizePlayer(raw) {
  const base = createDefaultPlayer();
  if (!raw || typeof raw !== "object") return base;

  const version = Number.isFinite(raw.version) ? raw.version : SAVE_VERSION;
  const points = typeof raw.points === "string" || typeof raw.points === "number" ? String(raw.points) : "0";

  const upgrades = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {};
  const damageLevel = Math.max(0, (upgrades.damageLevel ?? 0) | 0);
  const speedLevel = Math.max(0, (upgrades.speedLevel ?? 0) | 0);

  const map = raw.map && typeof raw.map === "object" ? raw.map : {};
  const pattern = typeof map.pattern === "string" ? map.pattern : base.map.pattern;
  const seed =
    map.seed === null || map.seed === undefined || Number.isFinite(map.seed) ? (map.seed ?? null) : base.map.seed;

  const game = raw.game && typeof raw.game === "object" ? raw.game : {};
  const balls = Array.isArray(game.balls) ? game.balls : [];

  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const createdAt = Number.isFinite(meta.createdAt) ? meta.createdAt : base.meta.createdAt;
  const lastSavedAt = Number.isFinite(meta.lastSavedAt) ? meta.lastSavedAt : null;

  return {
    version,
    points,
    upgrades: { damageLevel, speedLevel },
    map: { pattern, seed },
    game: { balls },
    meta: { createdAt, lastSavedAt },
  };
}

export function getPoints(player) {
  return D(player.points ?? "0");
}

export function setPoints(player, pointsDecimal) {
  player.points = pointsDecimal.toString();
}

export function addPoints(player, deltaDecimal) {
  setPoints(player, getPoints(player).add(deltaDecimal));
}

export function canAfford(player, costDecimal) {
  return getPoints(player).gte(costDecimal);
}

export function trySpendPoints(player, costDecimal) {
  if (!canAfford(player, costDecimal)) return false;
  setPoints(player, getPoints(player).sub(costDecimal));
  return true;
}

export function getBallSpawnCost() {
  return D(50);
}

export function getDamageUpgradeCost(player) {
  const level = player.upgrades?.damageLevel ?? 0;
  return D(150).mul(D(1.65).pow(level));
}

export function getSpeedUpgradeCost(player) {
  const level = player.upgrades?.speedLevel ?? 0;
  return D(150).mul(D(1.65).pow(level));
}

export function getDamageMultiplier(player) {
  const level = player.upgrades?.damageLevel ?? 0;
  return 1 + 0.25 * level;
}

export function getSpeedMultiplier(player) {
  const level = player.upgrades?.speedLevel ?? 0;
  return 1 + 0.12 * level;
}

export function savePlayerToStorage(player) {
  const now = Date.now();
  const serializable = normalizePlayer(player);
  serializable.meta.lastSavedAt = now;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
  return serializable;
}

export function loadPlayerFromStorage() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizePlayer(parsed);
  } catch {
    return null;
  }
}

