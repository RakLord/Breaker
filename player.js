import { D } from "./numbers.js";

const SAVE_KEY = "breaker_player_save_v1";
const SAVE_VERSION = 1;

export const BALL_SHOP_CONFIG = {
  normal: { cap: 10, baseCost: D(50), costGrowth: D(1.18) },
  splash: { cap: 10, baseCost: D(500), costGrowth: D(1.22) },
  sniper: { cap: 5, baseCost: D(2500), costGrowth: D(1.25) },
};

export function createDefaultPlayer() {
  return {
    version: SAVE_VERSION,
    points: "0",
    ballTypes: {},
    cursor: {
      level: 0,
    },
    progress: {
      level: 1,
      masterSeed: (Math.random() * 2 ** 32) >>> 0,
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

  const rawBallTypes = raw.ballTypes && typeof raw.ballTypes === "object" ? raw.ballTypes : {};
  const legacyUpgrades = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : null;
  const legacyDamageLevel = legacyUpgrades ? Math.max(0, (legacyUpgrades.damageLevel ?? 0) | 0) : 0;
  const legacySpeedLevel = legacyUpgrades ? Math.max(0, (legacyUpgrades.speedLevel ?? 0) | 0) : 0;

  const ballTypes = {};
  for (const [typeId, cfg] of Object.entries(rawBallTypes)) {
    if (!typeId) continue;
    const obj = cfg && typeof cfg === "object" ? cfg : {};
    ballTypes[typeId] = {
      damageLevel: Math.max(0, (obj.damageLevel ?? 0) | 0),
      speedLevel: Math.max(0, (obj.speedLevel ?? 0) | 0),
      rangeLevel: Math.max(0, (obj.rangeLevel ?? 0) | 0),
    };
  }

  if (legacyUpgrades && Object.keys(ballTypes).length === 0) {
    ballTypes.normal = { damageLevel: legacyDamageLevel, speedLevel: legacySpeedLevel };
  }

  const rawCursor = raw.cursor && typeof raw.cursor === "object" ? raw.cursor : {};
  const cursorLevel = Math.max(0, (rawCursor.level ?? 0) | 0);

  const map = raw.map && typeof raw.map === "object" ? raw.map : {};
  const pattern = typeof map.pattern === "string" ? map.pattern : base.map.pattern;
  const seed =
    map.seed === null || map.seed === undefined || Number.isFinite(map.seed) ? (map.seed ?? null) : base.map.seed;

  const rawProgress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const level = Math.max(1, (rawProgress.level ?? 1) | 0);
  const masterSeed = Number.isFinite(rawProgress.masterSeed)
    ? (rawProgress.masterSeed >>> 0)
    : Number.isFinite(seed)
      ? (seed >>> 0)
      : Number.isFinite(base.progress.masterSeed)
        ? base.progress.masterSeed
        : ((Math.random() * 2 ** 32) >>> 0);

  const game = raw.game && typeof raw.game === "object" ? raw.game : {};
  const balls = Array.isArray(game.balls) ? game.balls : [];

  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const createdAt = Number.isFinite(meta.createdAt) ? meta.createdAt : base.meta.createdAt;
  const lastSavedAt = Number.isFinite(meta.lastSavedAt) ? meta.lastSavedAt : null;

  return {
    version,
    points,
    ballTypes,
    cursor: { level: cursorLevel },
    progress: { level, masterSeed },
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

export function ensureBallTypeState(player, typeId) {
  if (!player.ballTypes || typeof player.ballTypes !== "object") player.ballTypes = {};
  if (!player.ballTypes[typeId]) {
    player.ballTypes[typeId] = { damageLevel: 0, speedLevel: 0, rangeLevel: 0 };
  }
  const s = player.ballTypes[typeId];
  s.damageLevel = Math.max(0, (s.damageLevel ?? 0) | 0);
  s.speedLevel = Math.max(0, (s.speedLevel ?? 0) | 0);
  s.rangeLevel = Math.max(0, (s.rangeLevel ?? 0) | 0);
  return s;
}

export function getBallCap(typeId) {
  return BALL_SHOP_CONFIG[typeId]?.cap ?? 0;
}

export function getBallBuyCost(typeId, ownedCount) {
  const cfg = BALL_SHOP_CONFIG[typeId];
  if (!cfg) return D(999999999);
  const n = Math.max(0, ownedCount | 0);
  return cfg.baseCost.mul(cfg.costGrowth.pow(n));
}

export function ensureCursorState(player) {
  if (!player.cursor || typeof player.cursor !== "object") player.cursor = { level: 0 };
  player.cursor.level = Math.max(0, (player.cursor.level ?? 0) | 0);
  return player.cursor;
}

export function getCursorDamage(player) {
  const level = ensureCursorState(player).level;
  return 1 + level;
}

export function getCursorUpgradeCost(player) {
  const level = ensureCursorState(player).level;
  return D(100).mul(D(1.6).pow(level));
}

export function getBallDamageUpgradeCost(player, typeId) {
  const level = ensureBallTypeState(player, typeId).damageLevel;
  const baseCost = BALL_SHOP_CONFIG[typeId]?.baseCost ?? D(100);
  return baseCost.mul(D(1.6).pow(level));
}

export function getBallSpeedUpgradeCost(player, typeId) {
  const level = ensureBallTypeState(player, typeId).speedLevel;
  const baseCost = BALL_SHOP_CONFIG[typeId]?.baseCost ?? D(100);
  return baseCost.mul(D(1.6).pow(level));
}

export function getSplashRangeLevel(player) {
  return ensureBallTypeState(player, "splash").rangeLevel;
}

export function getSplashRangeUpgradeCost(player) {
  const level = getSplashRangeLevel(player);
  return D(500).mul(D(5).pow(level));
}

export function getSplashRangeCap() {
  return 4;
}

export function getBallDamageMultiplier(player, typeId) {
  const level = ensureBallTypeState(player, typeId).damageLevel;
  return 1 + 0.25 * level;
}

export function getBallSpeedMultiplier(player, typeId) {
  const level = ensureBallTypeState(player, typeId).speedLevel;
  return 1 + 0.24 * level;
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

export function clearPlayerSaveFromStorage() {
  localStorage.removeItem(SAVE_KEY);
}
