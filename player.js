import { D } from "./numbers.js";

const SAVE_KEY = "breaker_player_save_v1";
const SAVE_VERSION = 1;

export const BALL_SHOP_CONFIG = {
  normal: { cap: 10, baseCost: D(50), costGrowth: D(1.18) },
  splash: { cap: 10, baseCost: D(500), costGrowth: D(1.22) },
  sniper: { cap: 5, baseCost: D(2500), costGrowth: D(1.25) },
  sweeper: { cap: 5, baseCost: D(1500), costGrowth: D(1.24) },
};

export const CLEARS_SHOP_CONFIG = {
  density: {
    thresholdStep: 0.02,
    minNoiseThreshold: 0.1,
    maxFillRatio: 0.9,
    baseCost: D(1),
    costGrowth: D(2),
  },
  gridSize: {
    maxLevel: 100,
    maxCellsPerAxis: 100,
    baseCost: D(1),
    costGrowth: D(1.35),
  },
  brickHp: {
    maxLevel: 200,
    baseCost: D(1),
    costGrowth: D(1.55),
  },
};

export function createDefaultPlayer() {
  return {
    version: SAVE_VERSION,
    points: "0",
    clears: "0",
    stars: 0,
    clearsStats: {
      prestiges: 0,
      lastGain: 0,
      bestGain: 0,
    },
    starStats: {
      prestiges: 0,
      earnedTotal: 0,
      spentTotal: 0,
      lastPrestigeLevel: null,
    },
    clearsBuffered: 0,
    clearsBufferedBricks: 0,
    clearsUpgrades: {
      densityLevel: 0,
      gridSizeLevel: 0,
      brickHpLevel: 0,
    },
    starUpgrades: {
      pieceCount: false,
      criticalHits: false,
      execution: false,
      clearsLogMult: false,
      placeholder1: false,
      placeholder2: false,
      placeholder3: false,
    },
    ballTypes: {},
    cursor: {
      level: 0,
    },
    generation: {
      noiseThreshold: 0.65,
      desiredCellSize: 56,
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
      grid: null,
      initialBlocks: 0,
    },
    meta: {
      createdAt: Date.now(),
      lastSavedAt: null,
    },
  };
}

function normalizeGameGrid(rawGrid) {
  if (!rawGrid || typeof rawGrid !== "object") return null;

  const cols = Math.max(1, rawGrid.cols | 0);
  const rows = Math.max(1, rawGrid.rows | 0);
  const maxAxis = CLEARS_SHOP_CONFIG.gridSize.maxCellsPerAxis ?? 100;
  if (cols > maxAxis || rows > maxAxis) return null;

  const size = cols * rows;
  const hpRaw = Array.isArray(rawGrid.hp) ? rawGrid.hp : null;
  const maxHpRaw = Array.isArray(rawGrid.maxHp) ? rawGrid.maxHp : null;
  if (!hpRaw || !maxHpRaw || hpRaw.length !== size || maxHpRaw.length !== size) return null;

  const hp = new Array(size);
  const maxHp = new Array(size);
  for (let i = 0; i < size; i++) {
    const h = Number(hpRaw[i]);
    const mh = Number(maxHpRaw[i]);
    const safeHp = Number.isFinite(h) ? Math.max(0, h) : 0;
    const safeMaxHp = Number.isFinite(mh) ? Math.max(safeHp, mh) : safeHp;
    hp[i] = safeHp;
    maxHp[i] = safeMaxHp;
  }

  const cellSize = Number.isFinite(rawGrid.cellSize) ? rawGrid.cellSize : null;
  const originX = Number.isFinite(rawGrid.originX) ? rawGrid.originX : null;
  const originY = Number.isFinite(rawGrid.originY) ? rawGrid.originY : null;

  return {
    cols,
    rows,
    cellSize: cellSize && cellSize > 0 ? cellSize : null,
    originX,
    originY,
    hp,
    maxHp,
  };
}

export function normalizePlayer(raw) {
  const base = createDefaultPlayer();
  if (!raw || typeof raw !== "object") return base;

  const version = Number.isFinite(raw.version) ? raw.version : SAVE_VERSION;
  const points = typeof raw.points === "string" || typeof raw.points === "number" ? String(raw.points) : "0";
  const clears = typeof raw.clears === "string" || typeof raw.clears === "number" ? String(raw.clears) : "0";
  const stars =
    typeof raw.stars === "string" || typeof raw.stars === "number" ? Math.max(0, Number.parseInt(raw.stars, 10) || 0) : 0;
  const clearsBuffered = Math.max(0, (raw.clearsBuffered ?? 0) | 0);
  const clearsBufferedBricks = Math.max(0, (raw.clearsBufferedBricks ?? 0) | 0);

  const rawClearsStats = raw.clearsStats && typeof raw.clearsStats === "object" ? raw.clearsStats : {};
  const clearsStats = {
    prestiges: Math.max(0, (rawClearsStats.prestiges ?? 0) | 0),
    lastGain: Math.max(0, (rawClearsStats.lastGain ?? 0) | 0),
    bestGain: Math.max(0, (rawClearsStats.bestGain ?? 0) | 0),
  };

  const rawStarStats = raw.starStats && typeof raw.starStats === "object" ? raw.starStats : {};
  const starStats = {
    prestiges: Math.max(0, (rawStarStats.prestiges ?? 0) | 0),
    earnedTotal: Math.max(0, (rawStarStats.earnedTotal ?? 0) | 0),
    spentTotal: Math.max(0, (rawStarStats.spentTotal ?? 0) | 0),
    lastPrestigeLevel: Number.isFinite(rawStarStats.lastPrestigeLevel) ? rawStarStats.lastPrestigeLevel : null,
  };
  starStats.earnedTotal = Math.max(starStats.earnedTotal, stars + starStats.spentTotal);

  const rawClearsUpgrades = raw.clearsUpgrades && typeof raw.clearsUpgrades === "object" ? raw.clearsUpgrades : {};
  const densityLevel = Math.max(0, (rawClearsUpgrades.densityLevel ?? 0) | 0);
  const gridSizeLevel = Math.max(0, (rawClearsUpgrades.gridSizeLevel ?? 0) | 0);
  const brickHpLevel = Math.max(0, (rawClearsUpgrades.brickHpLevel ?? 0) | 0);

  const rawStarUpgrades = raw.starUpgrades && typeof raw.starUpgrades === "object" ? raw.starUpgrades : {};
  const starUpgrades = {
    pieceCount: !!rawStarUpgrades.pieceCount,
    criticalHits: !!rawStarUpgrades.criticalHits,
    execution: !!rawStarUpgrades.execution,
    clearsLogMult: !!rawStarUpgrades.clearsLogMult,
    placeholder1: !!rawStarUpgrades.placeholder1,
    placeholder2: !!rawStarUpgrades.placeholder2,
    placeholder3: !!rawStarUpgrades.placeholder3,
  };

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
      pieceLevel: Math.max(0, (obj.pieceLevel ?? 0) | 0),
      critLevel: Math.max(0, (obj.critLevel ?? 0) | 0),
      executionLevel: Math.max(0, (obj.executionLevel ?? 0) | 0),
    };
  }

  if (legacyUpgrades && Object.keys(ballTypes).length === 0) {
    ballTypes.normal = {
      damageLevel: legacyDamageLevel,
      speedLevel: legacySpeedLevel,
      rangeLevel: 0,
      pieceLevel: 0,
      critLevel: 0,
      executionLevel: 0,
    };
  }

  const rawCursor = raw.cursor && typeof raw.cursor === "object" ? raw.cursor : {};
  const cursorLevel = Math.max(0, (rawCursor.level ?? 0) | 0);

  const rawGen = raw.generation && typeof raw.generation === "object" ? raw.generation : {};
  const noiseThreshold = Number.isFinite(rawGen.noiseThreshold) ? rawGen.noiseThreshold : base.generation.noiseThreshold;
  const desiredCellSize = Number.isFinite(rawGen.desiredCellSize) ? rawGen.desiredCellSize : base.generation.desiredCellSize;

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
  const grid = normalizeGameGrid(game.grid);
  const initialBlocks = Math.max(0, (game.initialBlocks ?? 0) | 0);

  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const createdAt = Number.isFinite(meta.createdAt) ? meta.createdAt : base.meta.createdAt;
  const lastSavedAt = Number.isFinite(meta.lastSavedAt) ? meta.lastSavedAt : null;

  return {
    version,
    points,
    clears,
    stars,
    clearsStats,
    starStats,
    clearsBuffered,
    clearsBufferedBricks,
    clearsUpgrades: { densityLevel, gridSizeLevel, brickHpLevel },
    starUpgrades,
    ballTypes,
    cursor: { level: cursorLevel },
    generation: {
      noiseThreshold,
      desiredCellSize,
    },
    progress: { level, masterSeed },
    map: { pattern, seed },
    game: { balls, grid, initialBlocks },
    meta: { createdAt, lastSavedAt },
  };
}

export function getPoints(player) {
  return D(player.points ?? "0");
}

export function getClears(player) {
  return D(player.clears ?? "0");
}

export function setClears(player, clearsDecimal) {
  player.clears = clearsDecimal.toString();
}

export function addClears(player, deltaDecimal) {
  setClears(player, getClears(player).add(deltaDecimal));
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

export function canAffordClears(player, costDecimal) {
  return getClears(player).gte(costDecimal);
}

export function trySpendPoints(player, costDecimal) {
  if (!canAfford(player, costDecimal)) return false;
  setPoints(player, getPoints(player).sub(costDecimal));
  return true;
}

export function trySpendClears(player, costDecimal) {
  if (!canAffordClears(player, costDecimal)) return false;
  setClears(player, getClears(player).sub(costDecimal));
  return true;
}

export function ensureClearsUpgrades(player) {
  if (!player.clearsUpgrades || typeof player.clearsUpgrades !== "object") {
    player.clearsUpgrades = { densityLevel: 0, gridSizeLevel: 0, brickHpLevel: 0 };
  }
  player.clearsUpgrades.densityLevel = Math.max(0, (player.clearsUpgrades.densityLevel ?? 0) | 0);
  player.clearsUpgrades.gridSizeLevel = Math.max(0, (player.clearsUpgrades.gridSizeLevel ?? 0) | 0);
  player.clearsUpgrades.brickHpLevel = Math.max(0, (player.clearsUpgrades.brickHpLevel ?? 0) | 0);
  player.clearsUpgrades.gridSizeLevel = Math.min(
    CLEARS_SHOP_CONFIG.gridSize.maxLevel,
    player.clearsUpgrades.gridSizeLevel
  );
  player.clearsUpgrades.brickHpLevel = Math.min(CLEARS_SHOP_CONFIG.brickHp.maxLevel, player.clearsUpgrades.brickHpLevel);
  return player.clearsUpgrades;
}

export function getDensityUpgradeLevel(player) {
  return ensureClearsUpgrades(player).densityLevel;
}

export function getDensityUpgradeCost(player) {
  const level = getDensityUpgradeLevel(player);
  const cfg = CLEARS_SHOP_CONFIG.density;
  return cfg.baseCost.mul(cfg.costGrowth.pow(level));
}

export function getGridSizeUpgradeLevel(player) {
  return ensureClearsUpgrades(player).gridSizeLevel;
}

export function getGridSizeUpgradeCost(player) {
  const level = getGridSizeUpgradeLevel(player);
  const cfg = CLEARS_SHOP_CONFIG.gridSize;
  return cfg.baseCost.mul(cfg.costGrowth.pow(level));
}

export function getBrickHpUpgradeLevel(player) {
  return ensureClearsUpgrades(player).brickHpLevel;
}

export function getBrickHpUpgradeCost(player) {
  const level = getBrickHpUpgradeLevel(player);
  const cfg = CLEARS_SHOP_CONFIG.brickHp;
  return cfg.baseCost.mul(cfg.costGrowth.pow(level));
}

export function ensureBallTypeState(player, typeId) {
  if (!player.ballTypes || typeof player.ballTypes !== "object") player.ballTypes = {};
  if (!player.ballTypes[typeId]) {
    player.ballTypes[typeId] = {
      damageLevel: 0,
      speedLevel: 0,
      rangeLevel: 0,
      pieceLevel: 0,
      critLevel: 0,
      executionLevel: 0,
    };
  }
  const s = player.ballTypes[typeId];
  s.damageLevel = Math.max(0, (s.damageLevel ?? 0) | 0);
  s.speedLevel = Math.max(0, (s.speedLevel ?? 0) | 0);
  s.rangeLevel = Math.max(0, (s.rangeLevel ?? 0) | 0);
  s.pieceLevel = Math.max(0, (s.pieceLevel ?? 0) | 0);
  s.critLevel = Math.max(0, (s.critLevel ?? 0) | 0);
  s.executionLevel = Math.max(0, (s.executionLevel ?? 0) | 0);
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

export function getBallPieceCountUpgradeCost(player, typeId) {
  const level = ensureBallTypeState(player, typeId).pieceLevel;
  const baseCost = BALL_SHOP_CONFIG[typeId]?.baseCost ?? D(100);
  return baseCost.mul(D(6)).mul(D(2).pow(level));
}

export function getBallCritUpgradeCost(player, typeId) {
  const level = ensureBallTypeState(player, typeId).critLevel;
  const baseCost = BALL_SHOP_CONFIG[typeId]?.baseCost ?? D(100);
  return baseCost.mul(D(7)).mul(D(1.85).pow(level));
}

export function getBallExecutionUpgradeCost(player, typeId) {
  const level = ensureBallTypeState(player, typeId).executionLevel;
  const baseCost = BALL_SHOP_CONFIG[typeId]?.baseCost ?? D(100);
  return baseCost.mul(D(9)).mul(D(1.95).pow(level));
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

export function ensureGenerationSettings(player) {
  if (!player.generation || typeof player.generation !== "object") {
    player.generation = { noiseThreshold: 0.65, desiredCellSize: 56 };
  }
  if (!Number.isFinite(player.generation.noiseThreshold)) player.generation.noiseThreshold = 0.65;
  player.generation.noiseThreshold = Math.max(0, Math.min(1, player.generation.noiseThreshold));

  if (!Number.isFinite(player.generation.desiredCellSize)) player.generation.desiredCellSize = 56;
  player.generation.desiredCellSize = Math.max(8, player.generation.desiredCellSize);
  return player.generation;
}
