import { BlockGrid } from "./grid.js";
import { Ball, BALL_TYPES } from "./balls.js";
import { valueNoise2D } from "./rng.js";
import { D, formatInt } from "./numbers.js";
import {
  addClears,
  addPoints,
  canAfford,
  canAffordClears,
  clearPlayerSaveFromStorage,
  CLEARS_SHOP_CONFIG,
  createDefaultPlayer,
  ensureClearsUpgrades,
  ensureGenerationSettings,
  getDensityUpgradeCost,
  getDensityUpgradeLevel,
  getBallBuyCost,
  getBallCap,
  ensureBallTypeState,
  ensureCursorState,
  getCursorDamage,
  getCursorUpgradeCost,
  getBallDamageMultiplier,
  getBallDamageUpgradeCost,
  getBallPieceCountUpgradeCost,
  getBallCritUpgradeCost,
  getBallExecutionUpgradeCost,
  getClears,
  getGridSizeUpgradeCost,
  getGridSizeUpgradeLevel,
  getBrickHpUpgradeCost,
  getBrickHpUpgradeLevel,
  getPoints,
  getBallSpeedMultiplier,
  getBallSpeedUpgradeCost,
  getSplashRangeCap,
  getSplashRangeLevel,
  getSplashRangeUpgradeCost,
  loadPlayerFromStorage,
  normalizePlayer,
  savePlayerToStorage,
  trySpendClears,
  trySpendPoints,
} from "./player.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function getNoiseThresholdForMaxFill({ cols, rows, seed, noiseScale, maxFillRatio }) {
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

function updateCanvasView(canvas, world, view) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);

  const dpr = window.devicePixelRatio || 1;
  const pxWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const pxHeight = Math.max(1, Math.floor(cssHeight * dpr));

  if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
    canvas.width = pxWidth;
    canvas.height = pxHeight;
  }

  view.dpr = dpr;
  view.cssWidth = cssWidth;
  view.cssHeight = cssHeight;
  view.scale = Math.min(cssWidth / world.width, cssHeight / world.height);
  view.offsetX = (cssWidth - world.width * view.scale) * 0.5;
  view.offsetY = (cssHeight - world.height * view.scale) * 0.5;
}

function applyWorldTransform(ctx, view) {
  ctx.setTransform(
    view.dpr * view.scale,
    0,
    0,
    view.dpr * view.scale,
    view.dpr * view.offsetX,
    view.dpr * view.offsetY
  );
}

function screenToWorld(canvas, view, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const xCss = clientX - rect.left;
  const yCss = clientY - rect.top;
  return {
    x: (xCss - view.offsetX) / view.scale,
    y: (yCss - view.offsetY) / view.scale,
  };
}

function main() {
  const canvas = document.querySelector("#game-canvas");
  const pointsEl = document.querySelector("#points");
  const ballListEl = document.querySelector("#ball-list");
  const saveBtn = document.querySelector("#save-btn");
  const loadBtn = document.querySelector("#load-btn");
  const hardResetBtn = document.querySelector("#hard-reset-btn");
  const clearsShopBtn = document.querySelector("#clears-shop-btn");
  const starBoardBtn = document.querySelector("#star-board-btn");
  const hudLevelEl = document.querySelector("#hud-level");
  const cursorUpgradeBtn = document.querySelector("#cursor-upgrade-btn");
  const statsEl = document.querySelector("#stats");

  const clearsShopModal = document.querySelector("#clears-shop-modal");
  const clearsShopCloseBtn = document.querySelector("#clears-shop-close");
  const clearsShopBalanceEl = document.querySelector("#clears-shop-balance");
  const clearsDensityLvlEl = document.querySelector("#clears-density-lvl");
  const clearsDensityCostEl = document.querySelector("#clears-density-cost");
  const clearsDensityBuyBtn = document.querySelector("#clears-density-buy");
  const clearsGridLvlEl = document.querySelector("#clears-grid-lvl");
  const clearsGridCostEl = document.querySelector("#clears-grid-cost");
  const clearsGridBuyBtn = document.querySelector("#clears-grid-buy");
  const clearsGridInfoEl = document.querySelector("#clears-grid-info");
  const clearsHpLvlEl = document.querySelector("#clears-hp-lvl");
  const clearsHpCostEl = document.querySelector("#clears-hp-cost");
  const clearsHpBuyBtn = document.querySelector("#clears-hp-buy");
  const clearsHpInfoEl = document.querySelector("#clears-hp-info");

  const clearsModal = document.querySelector("#clears-modal");
  const clearsModalCloseBtn = document.querySelector("#clears-modal-close");
  const clearsBalanceEl = document.querySelector("#clears-balance");
  const clearsPrestigeBtn = document.querySelector("#clears-prestige-btn");
  const clearsPrestigeGainEl = document.querySelector("#clears-prestige-gain");
  const clearsStatsLine1El = document.querySelector("#clears-stats-line1");
  const clearsStatsLine2El = document.querySelector("#clears-stats-line2");
  const clearsStatsLine3El = document.querySelector("#clears-stats-line3");
  const clearsOpenShopBtn = document.querySelector("#clears-open-shop-btn");

  const starBoardModal = document.querySelector("#star-board-modal");
  const starBoardCloseBtn = document.querySelector("#star-board-close");
  const starBoardBalanceEl = document.querySelector("#star-board-balance");

  const starPieceStateEl = document.querySelector("#star-piece-state");
  const starPieceCapStateEl = document.querySelector("#star-piececap-state");
  const starCritStateEl = document.querySelector("#star-crit-state");
  const starExecStateEl = document.querySelector("#star-exec-state");
  const starClearsLogStateEl = document.querySelector("#star-clearslog-state");
  const starDmgMultStateEl = document.querySelector("#star-dmgmult-state");
  const starPersistStateEl = document.querySelector("#star-persist-state");
  const starAdvPersistStateEl = document.querySelector("#star-advpersist-state");
  const starTier2Box = document.querySelector("#star-tier2-box");
  const starTier3Box = document.querySelector("#star-tier3-box");

  const starPieceBuyBtn = document.querySelector("#star-piece-buy");
  const starPieceCapBuyBtn = document.querySelector("#star-piececap-buy");
  const starCritBuyBtn = document.querySelector("#star-crit-buy");
  const starExecBuyBtn = document.querySelector("#star-exec-buy");
  const starClearsLogBuyBtn = document.querySelector("#star-clearslog-buy");
  const starDmgMultBuyBtn = document.querySelector("#star-dmgmult-buy");
  const starPersistBuyBtn = document.querySelector("#star-persist-buy");
  const starAdvPersistBuyBtn = document.querySelector("#star-advpersist-buy");

  const starsModal = document.querySelector("#stars-modal");
  const starsModalCloseBtn = document.querySelector("#stars-modal-close");
  const starsBalanceEl = document.querySelector("#stars-balance");
  const starsPrestigeBtn = document.querySelector("#stars-prestige-btn");
  const starsPrestigeReqEl = document.querySelector("#stars-prestige-req");
  const starsStatsLine1El = document.querySelector("#stars-stats-line1");
  const starsStatsLine2El = document.querySelector("#stars-stats-line2");
  const starsStatsLine3El = document.querySelector("#stars-stats-line3");
  const starsOpenBoardBtn = document.querySelector("#stars-open-board-btn");

  if (!canvas) throw new Error("Missing #game-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const world = { width: 700, height: 700 };
  const view = {
    dpr: 1,
    cssWidth: 700,
    cssHeight: 700,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
  const worldSize = 1000;
  world.width = worldSize;
  world.height = worldSize;

  const grid = new BlockGrid({ cellSize: 56, cols: 10, rows: 10 });

  const state = {
    uiMessage: null,
    uiMessageUntil: 0,
    initialBlocks: 0,
  };

  let player = loadPlayerFromStorage() ?? createDefaultPlayer();
  player = normalizePlayer(player);
  ensureCursorState(player);
  ensureGenerationSettings(player);
  ensureClearsUpgrades(player);
  window.player = player;

  const game = {
    balls: [],
  };
  window.game = game;

  const ui = {
    ballCards: new Map(),
  };

  function updateGridFromPlayer() {
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);

    const desiredCellSize = player.generation.desiredCellSize;
    const baseCols = Math.max(4, Math.round(world.width / desiredCellSize));
    const maxCols = CLEARS_SHOP_CONFIG.gridSize.maxCellsPerAxis;
    const maxLevel = CLEARS_SHOP_CONFIG.gridSize.maxLevel;
    const level = player.clearsUpgrades.gridSizeLevel;

    const baseColsClamped = Math.min(baseCols, maxCols);
    const t = maxLevel > 0 ? clamp(level / maxLevel, 0, 1) : 0;
    const cols = clamp(Math.round(baseColsClamped + (maxCols - baseColsClamped) * t), 4, maxCols);

    const cellSize = world.width / cols;
    grid.cellSize = cellSize;
    grid.resize(cols, cols);
    grid.originX = 0;
    grid.originY = 0;
  }

  function getPieceCountForLevel(level) {
    return clamp(1 + Math.max(0, level | 0), 1, 9);
  }

  function getPieceUpgradeCapLevel() {
    ensureStarsState();
    const bonus = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
    return clamp(1 + bonus, 1, 3);
  }

  function getCritChanceForLevel(level) {
    return clamp(Math.max(0, level | 0) * 0.02, 0, 0.5);
  }

  function getExecuteRatioForLevel(level) {
    return clamp(Math.max(0, level | 0) * 0.05, 0, 0.5);
  }

  function applyUpgradesToAllBalls() {
    const speedMultByType = {};
    const damageMultByType = {};
    const splashRangeByType = {};
    const pieceCountByType = {};
    const critChanceByType = {};
    const executeRatioByType = {};

    const pieceUnlocked = getStarUpgradeOwned("pieceCount");
    const pieceCapLevel = getPieceUpgradeCapLevel();
    const critUnlocked = getStarUpgradeOwned("criticalHits");
    const execUnlocked = getStarUpgradeOwned("execution");
    const starDamageMult = getStarUpgradeOwned("damageMulti") ? 2 : 1;

    for (const typeId of Object.keys(BALL_TYPES)) {
      const typeState = ensureBallTypeState(player, typeId);
      speedMultByType[typeId] = getBallSpeedMultiplier(player, typeId);
      damageMultByType[typeId] = getBallDamageMultiplier(player, typeId);
      pieceCountByType[typeId] = pieceUnlocked ? getPieceCountForLevel(clamp(typeState.pieceLevel, 0, pieceCapLevel)) : 1;
      critChanceByType[typeId] = critUnlocked ? getCritChanceForLevel(typeState.critLevel) : 0;
      executeRatioByType[typeId] = execUnlocked ? getExecuteRatioForLevel(typeState.executionLevel) : 0;
      if (typeId === "splash") {
        const baseR = (BALL_TYPES.splash?.splashRadiusCells ?? 1) | 0;
        const bonus = typeState.rangeLevel | 0;
        splashRangeByType[typeId] = baseR + Math.max(0, bonus);
      }
    }

    for (const ball of game.balls) {
      const typeId = ball.typeId;
      const speedMult = speedMultByType[typeId] ?? 1;
      const damageMult = damageMultByType[typeId] ?? 1;
      ball.pieceCount = pieceCountByType[typeId] ?? 1;
      ball.critChance = critChanceByType[typeId] ?? 0;
      ball.critMultiplier = 2;
      ball.executeRatio = executeRatioByType[typeId] ?? 0;

      if (!ball.data || typeof ball.data !== "object") ball.data = {};

      if (!Number.isFinite(ball.data.baseSpeed)) {
        const currentSpeed = Math.hypot(ball.vx, ball.vy) || 0;
        ball.data.baseSpeed = speedMult > 0 ? currentSpeed / speedMult : currentSpeed;
      }
      if (!Number.isFinite(ball.data.baseDamage)) {
        const currentDamage = Number.isFinite(ball.damage) ? ball.damage : (ball.type?.baseDamage ?? 1);
        ball.data.baseDamage = damageMult > 0 ? currentDamage / (damageMult * starDamageMult) : currentDamage;
      }

      const desiredDamage = ball.data.baseDamage * damageMult * starDamageMult;
      if (Number.isFinite(desiredDamage) && ball.damage !== desiredDamage) ball.damage = desiredDamage;

      const desiredSpeed = ball.data.baseSpeed * speedMult;
      const currentSpeed = Math.hypot(ball.vx, ball.vy) || 0;
      if (Number.isFinite(desiredSpeed) && desiredSpeed > 0 && currentSpeed > 0) {
        const s = desiredSpeed / currentSpeed;
        if (Number.isFinite(s) && Math.abs(s - 1) > 1e-6) {
          ball.vx *= s;
          ball.vy *= s;
        }
      }

      if (typeId === "splash") {
        ball.splashRadiusCells = splashRangeByType.splash ?? ball.splashRadiusCells;
      }
    }
  }

  function setMessage(msg, seconds = 1.6) {
    state.uiMessage = msg;
    state.uiMessageUntil = performance.now() + seconds * 1000;
  }

  function ensureProgress() {
    if (!player.progress || typeof player.progress !== "object") {
      player.progress = { level: 1, masterSeed: (Math.random() * 2 ** 32) >>> 0 };
    }
    player.progress.level = Math.max(1, (player.progress.level ?? 1) | 0);
    if (!Number.isFinite(player.progress.masterSeed)) {
      player.progress.masterSeed = (Math.random() * 2 ** 32) >>> 0;
    } else {
      player.progress.masterSeed = player.progress.masterSeed >>> 0;
    }
  }

  function regenerate({ reseed = false } = {}) {
    ensureProgress();
    if (reseed) player.progress.masterSeed = (Math.random() * 2 ** 32) >>> 0;

    const level = player.progress.level;
    const seed = (player.progress.masterSeed + level) >>> 0;

    updateGridFromPlayer();
    ensureClearsUpgrades(player);
    const baseThreshold = player.generation.noiseThreshold;
    const densityLevel = getDensityUpgradeLevel(player);
    const step = CLEARS_SHOP_CONFIG.density.thresholdStep;
    const minThreshold = CLEARS_SHOP_CONFIG.density.minNoiseThreshold;
    const desiredThreshold = clamp(baseThreshold - densityLevel * step, minThreshold, 1);

    const noiseScale = 0.28;
    const capThreshold = getNoiseThresholdForMaxFill({
      cols: grid.cols,
      rows: grid.rows,
      seed,
      noiseScale,
      maxFillRatio: CLEARS_SHOP_CONFIG.density.maxFillRatio,
    });
    const noiseThreshold = Math.max(desiredThreshold, capThreshold);
    const brickHpLevel = getBrickHpUpgradeLevel(player);
    const startHp = Math.max(1, level - brickHpLevel);

    grid.generate({
      pattern: "noise",
      seed,
      noiseScale,
      noiseThreshold,
      hpMin: startHp,
      hpMax: startHp,
      filledRowsRatio: 1,
      emptyBorder: 0,
    });

    state.initialBlocks = countAliveBlocks(grid);
  }

  function tryRestoreGridFromPlayerSave() {
    const saved = player?.game?.grid;
    if (!saved) return false;

    const maxAxis = CLEARS_SHOP_CONFIG.gridSize.maxCellsPerAxis ?? 100;
    const ok = grid.applyJSONData(saved, { maxCols: maxAxis, maxRows: maxAxis, maxCells: maxAxis * maxAxis });
    if (!ok) return false;

    const savedInitial = player?.game?.initialBlocks;
    state.initialBlocks = Math.max(0, (savedInitial ?? 0) | 0);
    if (state.initialBlocks <= 0) state.initialBlocks = countAliveBlocks(grid);
    return true;
  }

  function spawnBallAt(x, y, typeId, { free = false } = {}) {
    const ownedCount = game.balls.reduce((acc, b) => acc + (b.typeId === typeId ? 1 : 0), 0);
    const cap = getBallCap(typeId);
    if (!free && cap > 0 && ownedCount >= cap) {
      setMessage(`${typeId} cap reached (${cap})`);
      return false;
    }

    const cost = getBallBuyCost(typeId, ownedCount);
    if (!free && !trySpendPoints(player, cost)) {
      setMessage(`Not enough points (need ${formatInt(cost)})`);
      return false;
    }

    const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
    const typeState = ensureBallTypeState(player, type.id);
    const damageMult = getBallDamageMultiplier(player, type.id);
    const starDamageMult = getStarUpgradeOwned("damageMulti") ? 2 : 1;
    const speedMult = getBallSpeedMultiplier(player, type.id);

    const angle = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
    const speed = (460 + Math.random() * 80) * speedMult;
    const ball = Ball.spawn({
      typeId,
      x,
      y,
      speed,
      angleRad: angle,
      damage: type.baseDamage * starDamageMult * damageMult,
      data: { baseSpeed: speed / (speedMult || 1), baseDamage: type.baseDamage },
    });
    if (type.id === "splash") {
      const baseR = type.splashRadiusCells ?? 1;
      const bonus = Math.max(0, typeState.rangeLevel | 0);
      ball.splashRadiusCells = baseR + bonus;
    }
    game.balls.push(ball);
    return true;
  }

  function savePlayerNow({ silent = false } = {}) {
    player.game.balls = game.balls.map((b) => b.toJSONData());
    player.game.grid = grid.toJSONData();
    player.game.initialBlocks = state.initialBlocks;
    player = savePlayerToStorage(player);
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    window.player = player;
    if (!silent) setMessage("Saved");
  }

  function loadPlayerNow() {
    const loaded = loadPlayerFromStorage();
    if (!loaded) {
      setMessage("No save found");
      return false;
    }

    player = normalizePlayer(loaded);
    ensureCursorState(player);
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    updateGridFromPlayer();
    window.player = player;

    game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
    if (!tryRestoreGridFromPlayerSave()) regenerate();
    if (game.balls.length === 0) spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    applyUpgradesToAllBalls();

    setMessage("Loaded");
    return true;
  }

  function hardResetNow() {
    const ok = window.confirm(
      "Hard reset will delete your save and reset everything to defaults.\n\nThis cannot be undone. Continue?"
    );
    if (!ok) return;

    clearPlayerSaveFromStorage();
    player = normalizePlayer(createDefaultPlayer());
    ensureCursorState(player);
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    updateGridFromPlayer();
    window.player = player;
    game.balls = [];
    regenerate({ reseed: true });
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    applyUpgradesToAllBalls();
    setMessage("Reset complete");
  }

  function prestigeNow() {
    const ok = window.confirm(
      "Prestige will reset your balls and upgrades, and convert buffered clears into clears.\n\nContinue?"
    );
    if (!ok) return false;

    ensureStarsState();
    const keepNormal = getStarUpgradeOwned("persistence");
    const keepOthers = getStarUpgradeOwned("advancedPersistence");
    const preservedBallTypes = {};
    if (keepNormal) {
      const s = ensureBallTypeState(player, "normal");
      preservedBallTypes.normal = { damageLevel: s.damageLevel, speedLevel: s.speedLevel };
    }
    if (keepOthers) {
      for (const typeId of Object.keys(BALL_TYPES)) {
        if (typeId === "normal") continue;
        const s = ensureBallTypeState(player, typeId);
        preservedBallTypes[typeId] = { damageLevel: s.damageLevel, speedLevel: s.speedLevel };
      }
    }

    const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
    ensureClearsStats();
    player.points = "0";
    player.clearsStats.prestiges += 1;
    player.clearsStats.lastGain = buffered;
    player.clearsStats.bestGain = Math.max(player.clearsStats.bestGain ?? 0, buffered);
    const bufferedBricks = Math.max(0, (player.clearsBufferedBricks ?? 0) | 0);
    let gain = buffered;
    if (getStarUpgradeOwned("clearsLogMult") && buffered > 0) {
      const mult = Math.max(1, Math.log(Math.max(1, bufferedBricks)));
      gain = Math.max(0, Math.floor(buffered * mult));
    }
    player.clearsStats.lastGain = gain;
    player.clearsStats.bestGain = Math.max(player.clearsStats.bestGain ?? 0, gain);
    if (gain > 0) addClears(player, D(gain));
    player.clearsBuffered = 0;
    player.clearsBufferedBricks = 0;
    ensureClearsUpgrades(player);

    player.ballTypes = preservedBallTypes;
    ensureCursorState(player).level = 0;
    game.balls = [];

    ensureProgress();
    player.progress.level = 1;
    updateGridFromPlayer();
    regenerate();
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    applyUpgradesToAllBalls();

    window.player = player;
    setMessage("Prestiged");
    return true;
  }

  function ensureStarsState() {
    if (!Number.isFinite(player.stars)) player.stars = 0;
    player.stars = Math.max(0, player.stars | 0);
    if (!player.starUpgrades || typeof player.starUpgrades !== "object") {
      player.starUpgrades = {
        pieceCount: false,
        pieceCap: 0,
        criticalHits: false,
        execution: false,
        clearsLogMult: false,
        damageMulti: false,
        persistence: false,
        advancedPersistence: false,
      };
    }
    for (const k of [
      "pieceCount",
      "criticalHits",
      "execution",
      "clearsLogMult",
      "damageMulti",
      "persistence",
      "advancedPersistence",
    ]) {
      player.starUpgrades[k] = !!player.starUpgrades[k];
    }
    player.starUpgrades.pieceCap = Math.max(0, Math.min(2, (player.starUpgrades.pieceCap ?? 0) | 0));

    if (!player.starStats || typeof player.starStats !== "object") {
      player.starStats = {
        prestiges: 0,
        earnedTotal: 0,
        spentTotal: 0,
        lastPrestigeLevel: null,
      };
    }
    player.starStats.prestiges = Math.max(0, (player.starStats.prestiges ?? 0) | 0);
    player.starStats.earnedTotal = Math.max(0, (player.starStats.earnedTotal ?? 0) | 0);
    player.starStats.spentTotal = Math.max(0, (player.starStats.spentTotal ?? 0) | 0);
    player.starStats.lastPrestigeLevel = Number.isFinite(player.starStats.lastPrestigeLevel)
      ? player.starStats.lastPrestigeLevel
      : null;
    player.starStats.earnedTotal = Math.max(player.starStats.earnedTotal, player.stars + player.starStats.spentTotal);
  }

  function ensureClearsStats() {
    if (!player.clearsStats || typeof player.clearsStats !== "object") {
      player.clearsStats = { prestiges: 0, lastGain: 0, bestGain: 0 };
    }
    player.clearsStats.prestiges = Math.max(0, (player.clearsStats.prestiges ?? 0) | 0);
    player.clearsStats.lastGain = Math.max(0, (player.clearsStats.lastGain ?? 0) | 0);
    player.clearsStats.bestGain = Math.max(0, (player.clearsStats.bestGain ?? 0) | 0);
    if (!Number.isFinite(player.clearsBufferedBricks)) player.clearsBufferedBricks = 0;
    player.clearsBufferedBricks = Math.max(0, player.clearsBufferedBricks | 0);
  }

  function canStarPrestige() {
    ensureProgress();
    return (player.progress?.level ?? 1) >= 20;
  }

  function starPrestigeNow() {
    ensureStarsState();
    if (!canStarPrestige()) {
      setMessage("Need Level 20");
      return false;
    }

    const ok = window.confirm(
      "Star Prestige will reset points/clears/balls and all lower-layer upgrades.\n\nYou will gain +1 Star.\n\nContinue?"
    );
    if (!ok) return false;

    const keepStars = Math.max(0, (player.stars ?? 0) | 0) + 1;
    const keepStarUpgrades = { ...(player.starUpgrades ?? {}) };
    const keepStarStats = { ...(player.starStats ?? {}) };
    keepStarStats.prestiges = Math.max(0, (keepStarStats.prestiges ?? 0) | 0) + 1;
    keepStarStats.earnedTotal = Math.max(0, (keepStarStats.earnedTotal ?? 0) | 0) + 1;
    keepStarStats.lastPrestigeLevel = player.progress?.level ?? null;

    player = normalizePlayer(createDefaultPlayer());
    player.stars = keepStars;
    player.starUpgrades = keepStarUpgrades;
    player.starStats = keepStarStats;

    ensureCursorState(player).level = 0;
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    ensureProgress();
    player.progress.level = 1;
    player.progress.masterSeed = (Math.random() * 2 ** 32) >>> 0;

    updateGridFromPlayer();
    window.player = player;

    game.balls = [];
    regenerate();
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    applyUpgradesToAllBalls();

    setMessage("Gained +1 Star");
    savePlayerNow({ silent: true });
    return true;
  }

  function getStarUpgradeOwned(key) {
    ensureStarsState();
    return !!player.starUpgrades?.[key];
  }

  function buyStarUpgrade(key, cost) {
    ensureStarsState();
    if (getStarUpgradeOwned(key)) return false;
    if (player.stars < cost) return false;
    player.stars -= cost;
    player.starStats.spentTotal = Math.max(0, (player.starStats.spentTotal ?? 0) | 0) + cost;
    player.starUpgrades[key] = true;
    return true;
  }

  function buyStarUpgradeLevel(key, cost, maxLevel) {
    ensureStarsState();
    const current = Math.max(0, (player.starUpgrades?.[key] ?? 0) | 0);
    const max = Math.max(0, maxLevel | 0);
    if (current >= max) return false;
    if (player.stars < cost) return false;
    player.stars -= cost;
    player.starStats.spentTotal = Math.max(0, (player.starStats.spentTotal ?? 0) | 0) + cost;
    player.starUpgrades[key] = current + 1;
    return true;
  }

  function openClearsShop() {
    if (!clearsShopModal) return;
    clearsShopModal.classList.remove("hidden");
    clearsShopModal.setAttribute("aria-hidden", "false");
  }

  function closeClearsShop() {
    if (!clearsShopModal) return;
    clearsShopModal.classList.add("hidden");
    clearsShopModal.setAttribute("aria-hidden", "true");
  }

  function openClearsModal() {
    if (!clearsModal) return;
    clearsModal.classList.remove("hidden");
    clearsModal.setAttribute("aria-hidden", "false");
  }

  function closeClearsModal() {
    if (!clearsModal) return;
    clearsModal.classList.add("hidden");
    clearsModal.setAttribute("aria-hidden", "true");
  }

  function openStarBoard() {
    if (!starBoardModal) return;
    starBoardModal.classList.remove("hidden");
    starBoardModal.setAttribute("aria-hidden", "false");
  }

  function closeStarBoard() {
    if (!starBoardModal) return;
    starBoardModal.classList.add("hidden");
    starBoardModal.setAttribute("aria-hidden", "true");
  }

  function openStarsModal() {
    if (!starsModal) return;
    starsModal.classList.remove("hidden");
    starsModal.setAttribute("aria-hidden", "false");
  }

  function closeStarsModal() {
    if (!starsModal) return;
    starsModal.classList.add("hidden");
    starsModal.setAttribute("aria-hidden", "true");
  }

  function getMaxDensityLevel() {
    ensureGenerationSettings(player);
    const baseThreshold = player.generation.noiseThreshold;
    const step = CLEARS_SHOP_CONFIG.density.thresholdStep;
    const minThreshold = CLEARS_SHOP_CONFIG.density.minNoiseThreshold;
    if (step <= 0) return 0;
    return Math.max(0, Math.floor((baseThreshold - minThreshold) / step));
  }

  function ensureBallCard(typeId) {
    if (!ballListEl) return null;
    if (ui.ballCards.has(typeId)) return ui.ballCards.get(typeId);

    const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
    ensureBallTypeState(player, type.id);

    const card = document.createElement("div");
    card.className = "ball-card";
    card.dataset.type = type.id;

    const rangeRow =
      type.id === "splash"
        ? `
        <div class="upgrade-row">
          <div class="upgrade-level">Lv <span data-role="rng-lvl">1</span></div>
          <button type="button" data-action="rng-up"><span class="btn-label">+1 Range</span> <span class="btn-cost" data-role="rng-cost">(0)</span></button>
        </div>
      `
        : "";

    card.innerHTML = `
      <div class="ball-summary">
        <div class="ball-name">${type.name}</div>
        <button type="button" data-action="buy"><span class="btn-label">Buy</span> <span class="btn-cost" data-role="buy-cost">(0)</span></button>
      </div>

      <div class="ball-details">
        <div class="ball-count">Count: <span data-role="count">0</span>/<span data-role="cap">0</span></div>

        <div class="ball-actions">
          <div class="upgrade-row">
            <div class="upgrade-level">Lv <span data-role="dmg-lvl">1</span></div>
            <button type="button" data-action="dmg-up"><span class="btn-label">+1 Damage</span> <span class="btn-cost" data-role="dmg-cost">(0)</span></button>
          </div>
          <div class="upgrade-row">
            <div class="upgrade-level">Lv <span data-role="spd-lvl">1</span></div>
            <button type="button" data-action="spd-up"><span class="btn-label">+1 Speed</span> <span class="btn-cost" data-role="spd-cost">(0)</span></button>
          </div>
          ${rangeRow}
          <div class="upgrade-row hidden" data-upgrade="piece">
            <div class="upgrade-level">Lv <span data-role="pc-lvl">1</span></div>
            <button type="button" data-action="pc-up"><span class="btn-label">+1 Piece</span> <span class="btn-cost" data-role="pc-cost">(0)</span></button>
          </div>
          <div class="upgrade-row hidden" data-upgrade="crit">
            <div class="upgrade-level">Lv <span data-role="crit-lvl">1</span></div>
            <button type="button" data-action="crit-up"><span class="btn-label">+1 Crit</span> <span class="btn-cost" data-role="crit-cost">(0)</span></button>
          </div>
          <div class="upgrade-row hidden" data-upgrade="exec">
            <div class="upgrade-level">Lv <span data-role="exec-lvl">1</span></div>
            <button type="button" data-action="exec-up"><span class="btn-label">+1 Execute</span> <span class="btn-cost" data-role="exec-cost">(0)</span></button>
          </div>
        </div>

        <div class="ball-stats">
          <div>Damage: <span data-role="damage">0</span></div>
          <div>Speed: <span data-role="speed">x1.00</span></div>
          <div class="hidden" data-role="pieces-row">Pieces: <span data-role="pieces">1</span></div>
          <div class="hidden" data-role="crit-row">Crit: <span data-role="crit">0%</span></div>
          <div class="hidden" data-role="exec-row">Execute: <span data-role="exec">0%</span></div>
        </div>
      </div>
    `;

    ballListEl.appendChild(card);
    ui.ballCards.set(type.id, card);
    return card;
  }

  function initBallShopUI() {
    if (!ballListEl) return;
    ballListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const card = btn.closest(".ball-card");
      const typeId = card?.dataset?.type;
      if (!typeId) return;

      const action = btn.dataset.action;
      if (action === "buy") {
        spawnBallAt(world.width * 0.5, world.height * 0.85, typeId);
        return;
      }
      if (action === "dmg-up") {
        const cost = getBallDamageUpgradeCost(player, typeId);
        if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
        ensureBallTypeState(player, typeId).damageLevel += 1;
        setMessage(`${typeId} damage upgraded`);
        return;
      }
      if (action === "spd-up") {
        const cost = getBallSpeedUpgradeCost(player, typeId);
        if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
        ensureBallTypeState(player, typeId).speedLevel += 1;
        setMessage(`${typeId} speed upgraded`);
        return;
      }
      if (action === "rng-up" && typeId === "splash") {
        const cap = getSplashRangeCap();
        const state = ensureBallTypeState(player, "splash");
        if (state.rangeLevel >= cap) return setMessage(`Splash range max (Lv ${cap})`);

        const cost = getSplashRangeUpgradeCost(player);
        if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
        state.rangeLevel += 1;
        setMessage(`Splash range upgraded`);
      }
      if (action === "pc-up") {
        if (!getStarUpgradeOwned("pieceCount")) return setMessage("Unlock Piece Count in Star Board");
        const cap = getPieceUpgradeCapLevel();
        const state = ensureBallTypeState(player, typeId);
        if (state.pieceLevel >= cap) return setMessage(`Piece cap reached (Lv ${cap})`);
        const cost = getBallPieceCountUpgradeCost(player, typeId);
        if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
        state.pieceLevel += 1;
        setMessage(`${typeId} piece count upgraded`);
        return;
      }
      if (action === "crit-up") {
        if (!getStarUpgradeOwned("criticalHits")) return setMessage("Unlock Critical Hits in Star Board");
        const cost = getBallCritUpgradeCost(player, typeId);
        if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
        ensureBallTypeState(player, typeId).critLevel += 1;
        setMessage(`${typeId} crit upgraded`);
        return;
      }
      if (action === "exec-up") {
        if (!getStarUpgradeOwned("execution")) return setMessage("Unlock Execution in Star Board");
        const cost = getBallExecutionUpgradeCost(player, typeId);
        if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
        ensureBallTypeState(player, typeId).executionLevel += 1;
        setMessage(`${typeId} execution upgraded`);
      }
    });

    for (const typeId of Object.keys(BALL_TYPES)) ensureBallCard(typeId);
  }

  saveBtn?.addEventListener("click", savePlayerNow);
  loadBtn?.addEventListener("click", loadPlayerNow);
  hardResetBtn?.addEventListener("click", hardResetNow);
  clearsShopBtn?.addEventListener("click", openClearsModal);
  starBoardBtn?.addEventListener("click", openStarsModal);
  clearsModalCloseBtn?.addEventListener("click", closeClearsModal);
  clearsModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (target?.dataset?.action === "close") closeClearsModal();
  });
  clearsPrestigeBtn?.addEventListener("click", () => {
    const did = prestigeNow();
    if (did) {
      closeClearsModal();
      openClearsShop();
    }
  });
  clearsOpenShopBtn?.addEventListener("click", () => {
    closeClearsModal();
    openClearsShop();
  });

  starsModalCloseBtn?.addEventListener("click", closeStarsModal);
  starsModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (target?.dataset?.action === "close") closeStarsModal();
  });
  starsPrestigeBtn?.addEventListener("click", () => {
    const did = starPrestigeNow();
    if (did) closeStarsModal();
  });
  starsOpenBoardBtn?.addEventListener("click", () => {
    closeStarsModal();
    openStarBoard();
  });

  starPieceBuyBtn?.addEventListener("click", () => {
    if (buyStarUpgrade("pieceCount", 1)) setMessage("Unlocked Piece Count upgrades");
    else setMessage("Need 1 Star");
  });
  starCritBuyBtn?.addEventListener("click", () => {
    if (buyStarUpgrade("criticalHits", 1)) setMessage("Unlocked Critical Hits upgrades");
    else setMessage("Need 1 Star");
  });
  starExecBuyBtn?.addEventListener("click", () => {
    if (buyStarUpgrade("execution", 1)) setMessage("Unlocked Execution upgrades");
    else setMessage("Need 1 Star");
  });
  const anyTier1Bought = () =>
    getStarUpgradeOwned("pieceCount") || getStarUpgradeOwned("criticalHits") || getStarUpgradeOwned("execution");
  const anyTier2Bought = () => {
    ensureStarsState();
    const pieceCap = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
    return (
      pieceCap > 0 ||
      getStarUpgradeOwned("clearsLogMult") ||
      getStarUpgradeOwned("damageMulti") ||
      getStarUpgradeOwned("persistence")
    );
  };
  starPieceCapBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (!getStarUpgradeOwned("pieceCount")) return setMessage("Unlock Piece Count first");
    if (buyStarUpgradeLevel("pieceCap", 3, 2)) setMessage("Piece cap increased");
    else setMessage("Need 3 Stars (or maxed)");
  });
  starClearsLogBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (buyStarUpgrade("clearsLogMult", 3)) setMessage("More Clears unlocked");
    else setMessage("Need 3 Stars");
  });
  starDmgMultBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (buyStarUpgrade("damageMulti", 3)) setMessage("Damage Multi unlocked");
    else setMessage("Need 3 Stars");
  });
  starPersistBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (buyStarUpgrade("persistence", 3)) setMessage("Persistance unlocked");
    else setMessage("Need 3 Stars");
  });
  starAdvPersistBuyBtn?.addEventListener("click", () => {
    const tier2Bought = anyTier2Bought();
    if (!tier2Bought) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgrade("advancedPersistence", 5)) setMessage("Advanced Persistance unlocked");
    else setMessage("Need 5 Stars");
  });
  cursorUpgradeBtn?.addEventListener("click", () => {
    const cost = getCursorUpgradeCost(player);
    if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
    ensureCursorState(player).level += 1;
    setMessage(`Cursor damage upgraded`);
  });
  clearsShopCloseBtn?.addEventListener("click", closeClearsShop);
  clearsShopModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (target?.dataset?.action === "close") closeClearsShop();
  });
  starBoardCloseBtn?.addEventListener("click", closeStarBoard);
  starBoardModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (target?.dataset?.action === "close") closeStarBoard();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeClearsShop();
    closeStarBoard();
    closeClearsModal();
    closeStarsModal();
  });
  clearsDensityBuyBtn?.addEventListener("click", () => {
    ensureClearsUpgrades(player);
    const level = getDensityUpgradeLevel(player);
    const maxLevel = getMaxDensityLevel();
    if (level >= maxLevel) return;

    const cost = getDensityUpgradeCost(player);
    if (!trySpendClears(player, cost)) return setMessage(`Need ${formatInt(cost)} clears`);
    player.clearsUpgrades.densityLevel += 1;
    regenerate();
    setMessage("Grid density upgraded");
  });
  clearsGridBuyBtn?.addEventListener("click", () => {
    ensureClearsUpgrades(player);
    const level = getGridSizeUpgradeLevel(player);
    const maxLevel = CLEARS_SHOP_CONFIG.gridSize.maxLevel;
    if (level >= maxLevel) return;

    const cost = getGridSizeUpgradeCost(player);
    if (!trySpendClears(player, cost)) return setMessage(`Need ${formatInt(cost)} clears`);
    player.clearsUpgrades.gridSizeLevel += 1;
    updateGridFromPlayer();
    regenerate();
    setMessage("Grid size upgraded");
  });
  clearsHpBuyBtn?.addEventListener("click", () => {
    ensureClearsUpgrades(player);
    const level = getBrickHpUpgradeLevel(player);
    const maxLevel = CLEARS_SHOP_CONFIG.brickHp.maxLevel;
    if (level >= maxLevel) return;

    const cost = getBrickHpUpgradeCost(player);
    if (!trySpendClears(player, cost)) return setMessage(`Need ${formatInt(cost)} clears`);
    player.clearsUpgrades.brickHpLevel += 1;
    regenerate();
    setMessage("Brick HP reduced");
  });
  window.addEventListener("beforeunload", () => savePlayerNow({ silent: true }));

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    const p = screenToWorld(canvas, view, e.clientX, e.clientY);
    if (p.x < 0 || p.y < 0 || p.x >= world.width || p.y >= world.height) return;

    const col = Math.floor((p.x - grid.originX) / grid.cellSize);
    const row = Math.floor((p.y - grid.originY) / grid.cellSize);
    if (!grid.inBounds(col, row)) return;

    const damage = getCursorDamage(player);
    const res = grid.applyDamageCell(col, row, damage);
    if (res.damageDealt > 0) {
      addPoints(player, D(res.damageDealt));
    }
  });

  const resizeObserver = new ResizeObserver(() => updateCanvasView(canvas, world, view));
  resizeObserver.observe(canvas);
  window.addEventListener("resize", () => updateCanvasView(canvas, world, view));
  updateCanvasView(canvas, world, view);
  initBallShopUI();

  ensureProgress();
  updateGridFromPlayer();
  if (!tryRestoreGridFromPlayerSave()) regenerate();

  game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
  if (game.balls.length === 0) {
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
  }
  applyUpgradesToAllBalls();

  setInterval(() => {
    savePlayerNow({ silent: true });
  }, 15000);

  let lastT = performance.now();
  let fpsSmoothed = 60;

  function frame(t) {
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;

    fpsSmoothed = fpsSmoothed * 0.93 + (1 / Math.max(1e-6, dt)) * 0.07;

    applyUpgradesToAllBalls();

    let damageDealt = 0;
    for (const ball of game.balls) damageDealt += ball.step(dt, world, grid);
    if (damageDealt > 0) {
      const rounded = Math.round(damageDealt * 1000) / 1000;
      addPoints(player, D(rounded));
    }

    let aliveBlocks = countAliveBlocks(grid);
    if (aliveBlocks === 0) {
      ensureProgress();
      player.progress.level += 1;
      ensureClearsStats();
      player.clearsBuffered = Math.max(0, (player.clearsBuffered ?? 0) | 0) + 1;
      player.clearsBufferedBricks = Math.max(0, (player.clearsBufferedBricks ?? 0) | 0) + (state.initialBlocks | 0);
      regenerate();
      aliveBlocks = countAliveBlocks(grid);
      setMessage(`Level ${player.progress.level} (+1 clear buffered)`);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyWorldTransform(ctx, view);

    ctx.strokeStyle = "rgba(241,245,249,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, world.width - 1, world.height - 1);

    grid.draw(ctx);
    for (const ball of game.balls) ball.draw(ctx);

    if (pointsEl) {
      pointsEl.innerHTML = `<span class="points-label">Points</span><span class="points-value">${formatInt(
        getPoints(player)
      )}</span>`;
    }

    const pointsNow = getPoints(player);
    const revealThreshold = D(0.75);
    const shouldReveal = (cost) => pointsNow.gte(cost.mul(revealThreshold));

    const countsByType = {};
    for (const ball of game.balls) countsByType[ball.typeId] = (countsByType[ball.typeId] ?? 0) + 1;
    const pieceUnlocked = getStarUpgradeOwned("pieceCount");
    const critUnlocked = getStarUpgradeOwned("criticalHits");
    const execUnlocked = getStarUpgradeOwned("execution");
    for (const typeId of Object.keys(BALL_TYPES)) {
      const card = ensureBallCard(typeId);
      if (!card) continue;
      const count = countsByType[typeId] ?? 0;

      const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
      const typeState = ensureBallTypeState(player, typeId);
      const dmgMult = getBallDamageMultiplier(player, typeId);
      const starDamageMult = getStarUpgradeOwned("damageMulti") ? 2 : 1;
      const spdMult = getBallSpeedMultiplier(player, typeId);
      const dmgCost = getBallDamageUpgradeCost(player, typeId);
      const spdCost = getBallSpeedUpgradeCost(player, typeId);
      const cap = getBallCap(typeId);
      const buyCost = getBallBuyCost(typeId, count);

      const unlocked = count > 0;
      card.classList.toggle("card-collapsed", !unlocked && !shouldReveal(buyCost));

      const countEl = card.querySelector('[data-role="count"]');
      if (countEl) countEl.textContent = String(count);
      const capEl = card.querySelector('[data-role="cap"]');
      if (capEl) capEl.textContent = String(cap);
      const dmgEl = card.querySelector('[data-role="damage"]');
      if (dmgEl) dmgEl.textContent = (type.baseDamage * starDamageMult * dmgMult).toFixed(2);
      const spdEl = card.querySelector('[data-role="speed"]');
      if (spdEl) spdEl.textContent = `x${spdMult.toFixed(2)}`;
      if (typeId === "splash") {
        const baseR = type.splashRadiusCells ?? 1;
        const radius = baseR + (typeState.rangeLevel ?? 0);
        if (spdEl) spdEl.textContent = `x${spdMult.toFixed(2)} | R${radius}`;
      }

      const pieceRow = card.querySelector('[data-upgrade="piece"]');
      if (pieceRow) pieceRow.classList.toggle("hidden", !pieceUnlocked);
      const critRow = card.querySelector('[data-upgrade="crit"]');
      if (critRow) critRow.classList.toggle("hidden", !critUnlocked);
      const execRow = card.querySelector('[data-upgrade="exec"]');
      if (execRow) execRow.classList.toggle("hidden", !execUnlocked);

      const buyBtn = card.querySelector('button[data-action="buy"]');
      if (buyBtn) {
        buyBtn.disabled = (cap > 0 && count >= cap) || !canAfford(player, buyCost);
        const costEl = buyBtn.querySelector('[data-role="buy-cost"]');
        if (costEl) costEl.textContent = `(${formatInt(buyCost)})`;
      }
      const dmgBtn = card.querySelector('button[data-action="dmg-up"]');
      if (dmgBtn) {
        dmgBtn.disabled = !canAfford(player, dmgCost);
        const lvlEl = card.querySelector('[data-role="dmg-lvl"]');
        if (lvlEl) lvlEl.textContent = String(typeState.damageLevel + 1);
        const costEl = card.querySelector('[data-role="dmg-cost"]');
        if (costEl) costEl.textContent = `(${formatInt(dmgCost)})`;
      }
      const spdBtn = card.querySelector('button[data-action="spd-up"]');
      if (spdBtn) {
        spdBtn.disabled = !canAfford(player, spdCost);
        const lvlEl = card.querySelector('[data-role="spd-lvl"]');
        if (lvlEl) lvlEl.textContent = String(typeState.speedLevel + 1);
        const costEl = card.querySelector('[data-role="spd-cost"]');
        if (costEl) costEl.textContent = `(${formatInt(spdCost)})`;
      }

      if (typeId === "splash") {
        const cap = getSplashRangeCap();
        const lvlEl = card.querySelector('[data-role="rng-lvl"]');
        if (lvlEl) lvlEl.textContent = String(typeState.rangeLevel + 1);

        const cost = getSplashRangeUpgradeCost(player);
        const costEl = card.querySelector('[data-role="rng-cost"]');
        if (costEl) costEl.textContent = `(${formatInt(cost)})`;

        const btn = card.querySelector('button[data-action="rng-up"]');
        if (btn) btn.disabled = typeState.rangeLevel >= cap || !canAfford(player, cost);
      }

      if (pieceUnlocked) {
        const cap = getPieceUpgradeCapLevel();
        const atCap = typeState.pieceLevel >= cap;
        const cost = getBallPieceCountUpgradeCost(player, typeId);
        const lvlEl = card.querySelector('[data-role="pc-lvl"]');
        if (lvlEl) lvlEl.textContent = atCap ? "MAX" : String(typeState.pieceLevel + 1);
        const costEl = card.querySelector('[data-role="pc-cost"]');
        if (costEl) costEl.textContent = atCap ? "(MAX)" : `(${formatInt(cost)})`;
        const btn = card.querySelector('button[data-action="pc-up"]');
        if (btn) btn.disabled = atCap || !canAfford(player, cost);
      }

      if (critUnlocked) {
        const cost = getBallCritUpgradeCost(player, typeId);
        const lvlEl = card.querySelector('[data-role="crit-lvl"]');
        if (lvlEl) lvlEl.textContent = String(typeState.critLevel + 1);
        const costEl = card.querySelector('[data-role="crit-cost"]');
        if (costEl) costEl.textContent = `(${formatInt(cost)})`;
        const btn = card.querySelector('button[data-action="crit-up"]');
        if (btn) btn.disabled = !canAfford(player, cost);
      }

      if (execUnlocked) {
        const cost = getBallExecutionUpgradeCost(player, typeId);
        const lvlEl = card.querySelector('[data-role="exec-lvl"]');
        if (lvlEl) lvlEl.textContent = String(typeState.executionLevel + 1);
        const costEl = card.querySelector('[data-role="exec-cost"]');
        if (costEl) costEl.textContent = `(${formatInt(cost)})`;
        const btn = card.querySelector('button[data-action="exec-up"]');
        if (btn) btn.disabled = !canAfford(player, cost);
      }

      const piecesRow = card.querySelector('[data-role="pieces-row"]');
      if (piecesRow) piecesRow.classList.toggle("hidden", !pieceUnlocked);
      const piecesEl = card.querySelector('[data-role="pieces"]');
      if (piecesEl && pieceUnlocked)
        piecesEl.textContent = String(getPieceCountForLevel(clamp(typeState.pieceLevel, 0, getPieceUpgradeCapLevel())));

      const critRowEl = card.querySelector('[data-role="crit-row"]');
      if (critRowEl) critRowEl.classList.toggle("hidden", !critUnlocked);
      const critEl = card.querySelector('[data-role="crit"]');
      if (critEl && critUnlocked) critEl.textContent = `${Math.round(getCritChanceForLevel(typeState.critLevel) * 100)}%`;

      const execRowEl = card.querySelector('[data-role="exec-row"]');
      if (execRowEl) execRowEl.classList.toggle("hidden", !execUnlocked);
      const execEl = card.querySelector('[data-role="exec"]');
      if (execEl && execUnlocked) execEl.textContent = `${Math.round(getExecuteRatioForLevel(typeState.executionLevel) * 100)}%`;
    }

    if (cursorUpgradeBtn) {
      const cost = getCursorUpgradeCost(player);
      const damage = getCursorDamage(player);
      cursorUpgradeBtn.textContent = `Cursor DMG ${damage} (+1) (${formatInt(cost)})`;
      cursorUpgradeBtn.disabled = !canAfford(player, cost);
    }

    const clearsNow = getClears(player);
    if (clearsShopBtn) {
      const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
      clearsShopBtn.textContent = buffered > 0 ? `Clears (${formatInt(clearsNow)} +${buffered})` : `Clears (${formatInt(clearsNow)})`;
    }
    if (clearsShopBalanceEl) {
      const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
      clearsShopBalanceEl.textContent = `Clears: ${formatInt(clearsNow)} (buffer +${buffered})`;
    }
    if (clearsDensityLvlEl && clearsDensityCostEl && clearsDensityBuyBtn) {
      const level = getDensityUpgradeLevel(player);
      const maxLevel = getMaxDensityLevel();
      const cost = getDensityUpgradeCost(player);
      clearsDensityLvlEl.textContent = String(level + 1);
      clearsDensityCostEl.textContent = `(${formatInt(cost)})`;
      clearsDensityBuyBtn.disabled = level >= maxLevel || !canAffordClears(player, cost);
    }
    if (clearsGridLvlEl && clearsGridCostEl && clearsGridBuyBtn) {
      const level = getGridSizeUpgradeLevel(player);
      const maxLevel = CLEARS_SHOP_CONFIG.gridSize.maxLevel;
      const maxCols = CLEARS_SHOP_CONFIG.gridSize.maxCellsPerAxis;
      const cost = getGridSizeUpgradeCost(player);

      const desiredCellSize = player.generation?.desiredCellSize ?? 56;
      const baseCols = Math.max(4, Math.round(world.width / desiredCellSize));
      const baseColsClamped = Math.min(baseCols, maxCols);
      const t = maxLevel > 0 ? clamp(level / maxLevel, 0, 1) : 0;
      const cols = clamp(Math.round(baseColsClamped + (maxCols - baseColsClamped) * t), 4, maxCols);

      clearsGridLvlEl.textContent = String(level + 1);
      clearsGridCostEl.textContent = `(${formatInt(cost)})`;
      clearsGridBuyBtn.disabled = level >= maxLevel || !canAffordClears(player, cost);
      if (clearsGridInfoEl) clearsGridInfoEl.textContent = `Cells per axis: ${cols}/${maxCols}`;
    }
    if (clearsHpLvlEl && clearsHpCostEl && clearsHpBuyBtn) {
      const level = getBrickHpUpgradeLevel(player);
      const maxLevel = CLEARS_SHOP_CONFIG.brickHp.maxLevel;
      const cost = getBrickHpUpgradeCost(player);
      clearsHpLvlEl.textContent = String(level + 1);
      clearsHpCostEl.textContent = `(${formatInt(cost)})`;
      clearsHpBuyBtn.disabled = level >= maxLevel || !canAffordClears(player, cost);

      if (clearsHpInfoEl) {
        const worldLevel = player.progress?.level ?? 1;
        const startHp = Math.max(1, worldLevel - level);
        clearsHpInfoEl.textContent = `Starting HP at Level ${worldLevel}: ${startHp}`;
      }
    }

    if (statsEl) {
      const msg = performance.now() < state.uiMessageUntil ? ` | ${state.uiMessage}` : "";
      const level = player.progress?.level ?? 1;
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      statsEl.textContent = `Balls: ${game.balls.length} | Blocks: ${aliveBlocks} | Level: ${level} | Stars: ${stars} | FPS: ${fpsSmoothed.toFixed(0)}${msg}`;
    }

    if (hudLevelEl) {
      const level = player.progress?.level ?? 1;
      const clears = formatInt(getClears(player));
      const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
      hudLevelEl.textContent = `Level ${level} | Bricks ${aliveBlocks}/${state.initialBlocks} | Clears ${clears} (+${buffered})`;
    }

    if (starBoardBtn) {
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      starBoardBtn.textContent = `Stars (${stars})`;
      const level = player.progress?.level ?? 1;
      starBoardBtn.classList.toggle("hidden", level <= 10);
    }
    if (starBoardBalanceEl) {
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      const tier1 = anyTier1Bought() ? "Tier 2 unlocked" : "Buy a Tier 1 upgrade";
      starBoardBalanceEl.textContent = `Stars: ${stars} | ${tier1}`;
    }

    if (
      clearsBalanceEl ||
      clearsPrestigeBtn ||
      clearsPrestigeGainEl ||
      clearsStatsLine1El ||
      clearsStatsLine2El ||
      clearsStatsLine3El
    ) {
      ensureClearsStats();
      const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
      const bufferedBricks = Math.max(0, (player.clearsBufferedBricks ?? 0) | 0);
      const hasLogBoost = getStarUpgradeOwned("clearsLogMult");
      const mult = hasLogBoost ? Math.max(1, Math.log(Math.max(1, bufferedBricks))) : 1;
      const gain = buffered > 0 ? Math.max(0, Math.floor(buffered * mult)) : 0;
      if (clearsBalanceEl) {
        const boostMsg = hasLogBoost ? ` | More Clears x${mult.toFixed(2)} (bricks ${bufferedBricks})` : "";
        clearsBalanceEl.textContent = `Clears: ${formatInt(clearsNow)} | Buffered: +${buffered} (${gain})${boostMsg}`;
      }
      if (clearsPrestigeGainEl) clearsPrestigeGainEl.textContent = `(+${gain})`;
      if (clearsPrestigeBtn) clearsPrestigeBtn.disabled = buffered <= 0;
      if (clearsStatsLine1El) clearsStatsLine1El.textContent = `${player.clearsStats.prestiges ?? 0}`;
      if (clearsStatsLine2El) clearsStatsLine2El.textContent = `+${player.clearsStats.lastGain ?? 0}`;
      if (clearsStatsLine3El) clearsStatsLine3El.textContent = `+${player.clearsStats.bestGain ?? 0}`;
    }

    if (starsBalanceEl || starsPrestigeBtn || starsPrestigeReqEl || starsStatsLine1El || starsStatsLine2El || starsStatsLine3El) {
      ensureStarsState();
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      const ok = canStarPrestige();
      if (starsBalanceEl) {
        const earned = Math.max(0, (player.starStats?.earnedTotal ?? 0) | 0);
        const spent = Math.max(0, (player.starStats?.spentTotal ?? 0) | 0);
        starsBalanceEl.textContent = `Stars: ${stars} | Earned: ${earned} | Spent: ${spent}`;
      }
      if (starsPrestigeBtn) starsPrestigeBtn.disabled = !ok;
      if (starsPrestigeReqEl) starsPrestigeReqEl.textContent = ok ? "Ready" : "Lv 20";
      const prestiges = Math.max(0, (player.starStats?.prestiges ?? 0) | 0);
      const last = player.starStats?.lastPrestigeLevel;
      const earned = Math.max(0, (player.starStats?.earnedTotal ?? 0) | 0);
      if (starsStatsLine1El) starsStatsLine1El.textContent = `${prestiges}`;
      if (starsStatsLine2El) starsStatsLine2El.textContent = Number.isFinite(last) ? `${last}` : "-";
      if (starsStatsLine3El) starsStatsLine3El.textContent = `${earned}`;
    }

    const setStarOwned = (el, owned) => {
      if (!el) return;
      el.textContent = owned ? "✓" : "-";
    };
    setStarOwned(starPieceStateEl, getStarUpgradeOwned("pieceCount"));
    if (starPieceCapStateEl) {
      ensureStarsState();
      const lv = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
      starPieceCapStateEl.textContent = `${Math.min(2, lv)}/2`;
    }
    setStarOwned(starCritStateEl, getStarUpgradeOwned("criticalHits"));
    setStarOwned(starExecStateEl, getStarUpgradeOwned("execution"));
    setStarOwned(starClearsLogStateEl, getStarUpgradeOwned("clearsLogMult"));
    setStarOwned(starDmgMultStateEl, getStarUpgradeOwned("damageMulti"));
    setStarOwned(starPersistStateEl, getStarUpgradeOwned("persistence"));
    setStarOwned(starAdvPersistStateEl, getStarUpgradeOwned("advancedPersistence"));

    const starsNow = Math.max(0, (player.stars ?? 0) | 0);
    if (starPieceBuyBtn) starPieceBuyBtn.disabled = getStarUpgradeOwned("pieceCount") || starsNow < 1;
    if (starCritBuyBtn) starCritBuyBtn.disabled = getStarUpgradeOwned("criticalHits") || starsNow < 1;
    if (starExecBuyBtn) starExecBuyBtn.disabled = getStarUpgradeOwned("execution") || starsNow < 1;

    const tier2Locked = !anyTier1Bought();
    if (starTier2Box) starTier2Box.classList.toggle("hidden", tier2Locked);
    const tier3Locked = !anyTier2Bought();
    if (starTier3Box) starTier3Box.classList.toggle("hidden", tier3Locked);
    if (starPieceCapBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
      starPieceCapBuyBtn.disabled = tier2Locked || lv >= 2 || starsNow < 3;
    }
    if (starClearsLogBuyBtn)
      starClearsLogBuyBtn.disabled = tier2Locked || getStarUpgradeOwned("clearsLogMult") || starsNow < 3;
    if (starDmgMultBuyBtn) starDmgMultBuyBtn.disabled = tier2Locked || getStarUpgradeOwned("damageMulti") || starsNow < 3;
    if (starPersistBuyBtn) starPersistBuyBtn.disabled = tier2Locked || getStarUpgradeOwned("persistence") || starsNow < 3;
    if (starAdvPersistBuyBtn)
      starAdvPersistBuyBtn.disabled =
        tier3Locked || getStarUpgradeOwned("advancedPersistence") || starsNow < 5;

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function countAliveBlocks(grid) {
  let alive = 0;
  const hp = grid.hp;
  for (let i = 0; i < hp.length; i++) if (hp[i] > 0) alive++;
  return alive;
}

main();
