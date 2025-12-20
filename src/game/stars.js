import { getClears } from "../../player.js";
import { clamp } from "./math.js";
import { ensureProgress } from "./progress.js";

export const STAR_PRESTIGE_LEVEL = 40;
export const STAR_COLLAPSE_STEP = STAR_PRESTIGE_LEVEL;
export const STAR_BETTER_FORMULA_MAX = 3;
export const STAR_BETTER_FORMULA_COST = 10;
export const STAR_BASIC_BALLS_COST = 5;
export const STAR_BRICK_BOOST_MAX = 3;
export const STAR_BRICK_BOOST_COST = 3;
export const STAR_MORE_POINTS_MAX = 10;
export const STAR_MORE_POINTS_COST = 5;
export const STAR_BUFFER_OVERFLOW_MAX = 3;
export const STAR_BUFFER_OVERFLOW_COST = 10;
export const STAR_BUFFER_OVERFLOW_RATE = 0.1;
export const STAR_MORE_STARS_COST = 15;
export const STAR_MORE_STARS_LOG_BASE = 10;
export const STAR_MORE_STARS_SCALE = 1;
export const STAR_MORE_STARS_MIN_MULT = 1;
export const STAR_BOARD_WIPE_COST = 10;
export const STAR_BOARD_WIPE_CHANCE = 0.0001;
export const STAR_MORE_BOARD_WIPES_COST = 15;
export const STAR_CLEAR_FIRE_SALE_COST = 15;
export const STAR_STARBOARD_MULT_COST = 15;
export const STAR_CURSOR_SPLASH_COST = 3;
export const STAR_TIME_MULT_COST = 5;
export const STAR_TIME_MULT_MIN_SEC = 60;
export const STAR_TIME_MULT_MAX_SEC = 60 * 60;
export const STAR_TIME_MULT_MIN = 1;
export const STAR_TIME_MULT_MAX = 5;
export const STAR_SPECIAL_CAP_COST = 5;

export function ensureStarsState(player) {
  if (!Number.isFinite(player.stars)) player.stars = 0;
  player.stars = Math.max(0, player.stars | 0);
  if (!player.starUpgrades || typeof player.starUpgrades !== "object") {
    player.starUpgrades = {
      pieceCount: false,
      pieceCap: 0,
      criticalHits: false,
      execution: false,
      normalCap: 0,
      clearsLogMult: false,
      damageMulti: false,
      persistence: false,
      dpsStats: false,
      cursorSplash: false,
      advancedPersistence: false,
      heavyBall: false,
      starCollapse: false,
      ballcountPersist: false,
      betterFormula: 0,
      betterBasicBalls: false,
      brickHpBoost: 0,
      morePoints: 0,
      bufferOverflow: 0,
      boardWipe: false,
      moreStars: false,
      moreBoardWipes: false,
      clearFireSale: false,
      starboardMultiplier: false,
      timeStarMult: false,
      specialCap: false,
    };
  }
  for (const k of [
    "pieceCount",
    "criticalHits",
    "execution",
    "clearsLogMult",
    "damageMulti",
    "persistence",
    "dpsStats",
    "cursorSplash",
    "advancedPersistence",
    "heavyBall",
    "starCollapse",
    "timeStarMult",
    "specialCap",
    "ballcountPersist",
    "boardWipe",
    "moreBoardWipes",
    "clearFireSale",
    "starboardMultiplier",
    "timeStarMult",
    "specialCap",
  ]) {
    player.starUpgrades[k] = !!player.starUpgrades[k];
  }
  player.starUpgrades.betterBasicBalls = !!player.starUpgrades.betterBasicBalls;
  player.starUpgrades.pieceCap = Math.max(0, Math.min(2, (player.starUpgrades.pieceCap ?? 0) | 0));
  player.starUpgrades.normalCap = Math.max(0, Math.min(2, (player.starUpgrades.normalCap ?? 0) | 0));
  player.starUpgrades.betterFormula = Math.max(
    0,
    Math.min(STAR_BETTER_FORMULA_MAX, (player.starUpgrades.betterFormula ?? 0) | 0)
  );
  player.starUpgrades.brickHpBoost = Math.max(
    0,
    Math.min(STAR_BRICK_BOOST_MAX, (player.starUpgrades.brickHpBoost ?? 0) | 0)
  );
  player.starUpgrades.morePoints = Math.max(
    0,
    Math.min(STAR_MORE_POINTS_MAX, (player.starUpgrades.morePoints ?? 0) | 0)
  );
  player.starUpgrades.bufferOverflow = Math.max(
    0,
    Math.min(STAR_BUFFER_OVERFLOW_MAX, (player.starUpgrades.bufferOverflow ?? 0) | 0)
  );
  player.starUpgrades.boardWipe = !!player.starUpgrades.boardWipe;
  player.starUpgrades.moreStars = !!player.starUpgrades.moreStars;
  player.starUpgrades.moreBoardWipes = !!player.starUpgrades.moreBoardWipes;
  player.starUpgrades.clearFireSale = !!player.starUpgrades.clearFireSale;
  player.starUpgrades.starboardMultiplier = !!player.starUpgrades.starboardMultiplier;
  player.starUpgrades.timeStarMult = !!player.starUpgrades.timeStarMult;
  player.starUpgrades.specialCap = !!player.starUpgrades.specialCap;
  player.starUpgrades.cursorSplash = !!player.starUpgrades.cursorSplash;

  if (!player.starStats || typeof player.starStats !== "object") {
    player.starStats = {
      prestiges: 0,
      earnedTotal: 0,
      spentTotal: 0,
      lastPrestigeLevel: null,
      lastPrestigeAt: Date.now(),
    };
  }
  player.starStats.prestiges = Math.max(0, (player.starStats.prestiges ?? 0) | 0);
  player.starStats.earnedTotal = Math.max(0, (player.starStats.earnedTotal ?? 0) | 0);
  player.starStats.spentTotal = Math.max(0, (player.starStats.spentTotal ?? 0) | 0);
  player.starStats.lastPrestigeLevel = Number.isFinite(player.starStats.lastPrestigeLevel)
    ? player.starStats.lastPrestigeLevel
    : null;
  player.starStats.lastPrestigeAt = Number.isFinite(player.starStats.lastPrestigeAt)
    ? player.starStats.lastPrestigeAt
    : Date.now();
  player.starStats.earnedTotal = Math.max(player.starStats.earnedTotal, player.stars + player.starStats.spentTotal);
  return player.starUpgrades;
}

export function getPieceUpgradeCapLevel(player) {
  ensureStarsState(player);
  const bonus = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
  return clamp(1 + bonus, 1, 3);
}

export function getStarUpgradeOwned(player, key) {
  ensureStarsState(player);
  return !!player.starUpgrades?.[key];
}

export function buyStarUpgrade(player, key, cost) {
  ensureStarsState(player);
  if (getStarUpgradeOwned(player, key)) return false;
  if (player.stars < cost) return false;
  player.stars -= cost;
  player.starStats.spentTotal = Math.max(0, (player.starStats.spentTotal ?? 0) | 0) + cost;
  player.starUpgrades[key] = true;
  return true;
}

export function buyStarUpgradeLevel(player, key, cost, maxLevel) {
  ensureStarsState(player);
  const current = Math.max(0, (player.starUpgrades?.[key] ?? 0) | 0);
  const max = Math.max(0, maxLevel | 0);
  if (current >= max) return false;
  if (player.stars < cost) return false;
  player.stars -= cost;
  player.starStats.spentTotal = Math.max(0, (player.starStats.spentTotal ?? 0) | 0) + cost;
  player.starUpgrades[key] = current + 1;
  return true;
}

export function getBetterFormulaLevel(player) {
  ensureStarsState(player);
  return Math.max(0, Math.min(STAR_BETTER_FORMULA_MAX, (player.starUpgrades?.betterFormula ?? 0) | 0));
}

export function getStarGainMultiplier(player) {
  const level = getBetterFormulaLevel(player);
  if (level <= 0) return 1;
  const clearsValue = getClears(player);
  const clearsNumber = Number.isFinite(clearsValue?.toNumber?.()) ? clearsValue.toNumber() : Number(clearsValue);
  const safeClears = Math.max(1, Number.isFinite(clearsNumber) ? clearsNumber : 1);
  const rawLog = typeof clearsValue?.log10 === "function" ? clearsValue.log10() : Math.log10(safeClears);
  const logValue = Number.isFinite(rawLog) ? rawLog : Number(rawLog);
  const rawMult = (Number.isFinite(logValue) ? logValue : 0) / level;
  return Math.max(1, rawMult);
}

export function getMoreStarsMultiplier(player) {
  if (!getStarUpgradeOwned(player, "moreStars")) return 1;
  const clearsValue = getClears(player);
  const clearsNumber = Number.isFinite(clearsValue?.toNumber?.()) ? clearsValue.toNumber() : Number(clearsValue);
  const safeClears = Math.max(1, Number.isFinite(clearsNumber) ? clearsNumber : 1);
  const rawLog = typeof clearsValue?.log10 === "function" ? clearsValue.log10() : Math.log10(safeClears);
  const logValue = Number.isFinite(rawLog) ? rawLog : Number(rawLog);
  const baseLog = Math.log10(STAR_MORE_STARS_LOG_BASE);
  const normalized = baseLog > 0 ? (Number.isFinite(logValue) ? logValue : 0) / baseLog : 0;
  const scaled = normalized * STAR_MORE_STARS_SCALE;
  return Math.max(STAR_MORE_STARS_MIN_MULT, scaled);
}

export function getTimeStarMultiplier(player) {
  if (!getStarUpgradeOwned(player, "timeStarMult")) return 1;
  ensureStarsState(player);
  const last = player.starStats?.lastPrestigeAt;
  const lastTime = Number.isFinite(last) ? last : Date.now();
  const elapsedSec = Math.max(0, (Date.now() - lastTime) / 1000);
  if (elapsedSec <= STAR_TIME_MULT_MIN_SEC) return STAR_TIME_MULT_MIN;
  if (elapsedSec >= STAR_TIME_MULT_MAX_SEC) return STAR_TIME_MULT_MAX;
  const t = (elapsedSec - STAR_TIME_MULT_MIN_SEC) / (STAR_TIME_MULT_MAX_SEC - STAR_TIME_MULT_MIN_SEC);
  return STAR_TIME_MULT_MIN + t * (STAR_TIME_MULT_MAX - STAR_TIME_MULT_MIN);
}

export function getStarboardUpgradeCount(player) {
  ensureStarsState(player);
  const u = player.starUpgrades ?? {};
  const bools = [
    "pieceCount",
    "criticalHits",
    "execution",
    "clearsLogMult",
    "damageMulti",
    "persistence",
    "dpsStats",
    "cursorSplash",
    "advancedPersistence",
    "heavyBall",
    "starCollapse",
    "timeStarMult",
    "ballcountPersist",
    "betterBasicBalls",
    "boardWipe",
    "moreStars",
    "moreBoardWipes",
    "clearFireSale",
    "starboardMultiplier",
  ];
  const levels = ["pieceCap", "normalCap", "betterFormula", "brickHpBoost", "morePoints", "bufferOverflow"];
  let count = 0;
  for (const key of bools) if (u[key]) count += 1;
  for (const key of levels) {
    const value = Number.isFinite(u[key]) ? Math.max(0, u[key] | 0) : 0;
    count += value;
  }
  return count;
}

export function getStarboardMultiplier(player) {
  if (!getStarUpgradeOwned(player, "starboardMultiplier")) return 1;
  return Math.max(1, getStarboardUpgradeCount(player));
}

export function getPointsGainMultiplier(player) {
  ensureStarsState(player);
  const level = Math.max(0, Math.min(STAR_MORE_POINTS_MAX, (player.starUpgrades?.morePoints ?? 0) | 0));
  if (level <= 0) return 1;
  return Math.pow(1.2, level);
}

export function getStarCollapseGain(player, levelRaw) {
  const level = Math.max(1, Number.isFinite(levelRaw) ? levelRaw : 1);
  if (level < STAR_PRESTIGE_LEVEL) return 0;
  const base = level / STAR_COLLAPSE_STEP;
  const mult = getStarGainMultiplier(player);
  return Math.max(1, Math.floor(base * mult));
}

export function getStarPrestigeGain(player) {
  ensureProgress(player);
  const level = player.progress?.level ?? 1;
  const base = getStarUpgradeOwned(player, "starCollapse") ? getStarCollapseGain(player, level) : 1;
  const mult = getMoreStarsMultiplier(player);
  const starboardMult = getStarboardMultiplier(player);
  const timeMult = getTimeStarMultiplier(player);
  return Math.max(1, Math.ceil(base * mult * starboardMult * timeMult));
}

export function getNextStarGainLevel(player, currentGain) {
  const gain = Math.max(1, currentGain | 0);
  const mult = getStarGainMultiplier(player);
  if (!Number.isFinite(mult) || mult <= 0) return null;
  const target = gain + 1;
  const rawLevel = Math.ceil((target / mult) * STAR_COLLAPSE_STEP);
  return Math.max(STAR_PRESTIGE_LEVEL, rawLevel);
}

export function canStarPrestige(player) {
  ensureProgress(player);
  return (player.progress?.level ?? 1) >= STAR_PRESTIGE_LEVEL;
}
