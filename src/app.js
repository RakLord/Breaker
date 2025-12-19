import { BlockGrid } from "../grid.js";
import { Ball, BALL_TYPES } from "../balls.js";
import { D, formatInt } from "../numbers.js";
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
  getBallDamageValue,
  getClears,
  getGridSizeUpgradeCost,
  getGridSizeUpgradeLevel,
  getBrickHpUpgradeCost,
  getBrickHpUpgradeLevel,
  getPoints,
  getBallSpeedMultiplier,
  loadPlayerFromStorage,
  normalizePlayer,
  savePlayerToStorage,
  trySpendClears,
  trySpendPoints,
} from "../player.js";
import { clamp } from "./game/math.js";
import { getNoiseThresholdForMaxFill, countAliveBlocks } from "./game/level.js";
import { updateCanvasView, applyWorldTransform, screenToWorld } from "./game/view.js";
import { buildPlayerSnapshot, encodeSaveString, decodeSaveString } from "./game/storage.js";
import { getPieceCountForLevel, getCritChanceForLevel, getExecuteRatioForLevel } from "./game/upgradeMath.js";
import { getDomRefs } from "./ui/dom.js";
import { initBallShopUI, updateBallShopCards } from "./ui/ballShop.js";
import { initTooltips } from "./tooltips.js";
import "tippy.js/dist/tippy.css";

export function startApp() {
  const dom = getDomRefs();
  const {
    canvas,
    pointsEl,
    ballListEl,
    saveBtn,
    loadBtn,
    hardResetBtn,
    clearsShopBtn,
    starBoardBtn,
    settingsBtn,
    ballContextBtn,
    hpOverlayBtn,
    hudLevelEl,
    statsEl,
    clearsShopModal,
    clearsShopCloseBtn,
    clearsShopBalanceEl,
    clearsDensityLvlEl,
    clearsDensityCostEl,
    clearsDensityBuyBtn,
    clearsGridLvlEl,
    clearsGridCostEl,
    clearsGridBuyBtn,
    clearsGridInfoEl,
    clearsHpLvlEl,
    clearsHpCostEl,
    clearsHpBuyBtn,
    clearsHpInfoEl,
    clearsModal,
    clearsModalCloseBtn,
    clearsBalanceEl,
    clearsPrestigeBtn,
    clearsPrestigeGainEl,
    clearsStatsLine1El,
    clearsStatsLine2El,
    clearsStatsLine3El,
    clearsOpenShopBtn,
    starBoardModal,
    starBoardCloseBtn,
    starBoardBalanceEl,
    starPieceStateEl,
    starPieceCapStateEl,
    starCritStateEl,
    starExecStateEl,
    starClearsLogStateEl,
    starDmgMultStateEl,
    starPersistStateEl,
    starAdvPersistStateEl,
    starTier2Box,
    starTier3Box,
    starPieceBuyBtn,
    starPieceCapBuyBtn,
    starCritBuyBtn,
    starExecBuyBtn,
    starClearsLogBuyBtn,
    starDmgMultBuyBtn,
    starPersistBuyBtn,
    starAdvPersistBuyBtn,
    starsModal,
    starsModalCloseBtn,
    starsBalanceEl,
    starsPrestigeBtn,
    starsPrestigeReqEl,
    starsStatsLine1El,
    starsStatsLine2El,
    starsStatsLine3El,
    starsOpenBoardBtn,
    starResetProgressTrack,
    starResetProgressFill,
    starResetProgressText,
    exportImportBtn,
    exportImportModal,
    exportImportCloseBtn,
    settingsModal,
    settingsCloseBtn,
    toastContainer,
    exportSaveText,
    importSaveText,
    exportSaveCopyBtn,
    importSaveLoadBtn,
  } = dom;

  const STAR_PRESTIGE_LEVEL = 40;

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
  world.cursor = { x: world.width * 0.5, y: world.height * 0.5, active: false };

  const grid = new BlockGrid({ cellSize: 56, cols: 10, rows: 10 });

  const state = {
    uiMessage: null,
    uiMessageUntil: 0,
    initialBlocks: 0,
    showHpOverlay: false,
    ballContextEnabled: false,
    ballContextType: null,
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

  function getPieceUpgradeCapLevel() {
    ensureStarsState();
    const bonus = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
    return clamp(1 + bonus, 1, 3);
  }

  function applyUpgradesToAllBalls() {
    const speedMultByType = {};
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
        const baseDamage = Number.isFinite(ball.type?.baseDamage) ? ball.type.baseDamage : 1;
        ball.data.baseDamage = baseDamage;
      }

      const desiredDamage = getBallDamageValue(player, typeId, ball.data.baseDamage) * starDamageMult;
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

  function dismissToast(toast) {
    if (!toast) return;
    if (toast._dismissTimer) {
      clearTimeout(toast._dismissTimer);
      toast._dismissTimer = null;
    }
    toast.remove();
  }

  function pushToast({ title, message, glowColor = null, timeoutMs = null } = {}) {
    if (!toastContainer) return null;
    const safeTitle = title || "Notice";
    const safeMessage = message || "";

    const toast = document.createElement("div");
    toast.className = "toast";
    if (glowColor) {
      toast.classList.add("toast--glow");
      toast.style.setProperty("--toast-glow", glowColor);
    }

    const header = document.createElement("div");
    header.className = "toast-header";

    const titleEl = document.createElement("div");
    titleEl.className = "toast-title";
    titleEl.textContent = safeTitle;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toast-close";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => dismissToast(toast));

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = safeMessage;

    toast.appendChild(header);
    toast.appendChild(body);
    toastContainer.appendChild(toast);

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      toast._dismissTimer = setTimeout(() => dismissToast(toast), timeoutMs);
    }

    return toast;
  }

  function drawManualBallRay(ctx, ball) {
    if (!ball?.data?.aimAtCursorOnWall) return;
    if (!world?.cursor?.active) return;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (!Number.isFinite(speed) || speed <= 0.01) return;

    const maxDistance = world.width * 1.5;
    const maxSegments = 8;
    const radius = Number.isFinite(ball.radius) ? ball.radius : 0;
    const stepLen = Math.max(2, radius * 0.75);
    const left = radius;
    const right = world.width - radius;
    const top = radius;
    const bottom = world.height - radius;

    let px = ball.x;
    let py = ball.y;
    let vx = ball.vx;
    let vy = ball.vy;
    let remaining = maxDistance;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, py);

    for (let i = 0; i < maxSegments && remaining > 0; i++) {
      const currentSpeed = Math.hypot(vx, vy);
      if (!Number.isFinite(currentSpeed) || currentSpeed <= 0.01) break;
      const ux = vx / currentSpeed;
      const uy = vy / currentSpeed;

      const tx = vx > 0 ? (right - px) / vx : vx < 0 ? (left - px) / vx : Infinity;
      const ty = vy > 0 ? (bottom - py) / vy : vy < 0 ? (top - py) / vy : Infinity;
      const tHit = Math.min(tx, ty);
      if (!Number.isFinite(tHit) || tHit <= 0) break;

      const segmentDistance = Math.min(currentSpeed * tHit, remaining);
      const steps = Math.max(1, Math.ceil(segmentDistance / stepLen));
      let traveled = 0;
      let hitBlock = false;

      for (let s = 0; s < steps; s++) {
        const stepDist = Math.min(stepLen, segmentDistance - traveled);
        traveled += stepDist;
        const sx = px + ux * traveled;
        const sy = py + uy * traveled;
        if (grid.findCircleCollision(sx, sy, radius)) {
          ctx.lineTo(sx, sy);
          remaining = 0;
          hitBlock = true;
          break;
        }
      }

      if (hitBlock) break;

      px += ux * segmentDistance;
      py += uy * segmentDistance;
      ctx.lineTo(px, py);
      remaining -= segmentDistance;

      if (segmentDistance < currentSpeed * tHit - 1e-6) break;

      const hitVertical = Math.abs(tHit - tx) < 1e-6;
      const hitHorizontal = Math.abs(tHit - ty) < 1e-6;
      if (hitVertical) vx = -vx;
      if (hitHorizontal) vy = -vy;

      const cursor = world?.cursor;
      if (cursor?.active && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
        const dx = cursor.x - px;
        const dy = cursor.y - py;
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) {
          vx = (dx / len) * currentSpeed;
          vy = (dy / len) * currentSpeed;
        }
      }
    }

    ctx.strokeStyle = "rgba(230, 201, 201, 0.03)";
    ctx.lineWidth = 5.0;
    ctx.stroke();
    ctx.restore();
  }

  function maybeShowManualBallToast(aliveBlocks) {
    const tutorials = ensureTutorialState();
    if (tutorials.manualBallToastShown) return;

    ensureClearsStats();
    if ((player.clearsStats?.prestiges ?? 0) !== 0) return;

    const initialBlocks = state.initialBlocks;
    if (!Number.isFinite(initialBlocks) || initialBlocks <= 0) return;
    if (!Number.isFinite(aliveBlocks) || aliveBlocks <= 0) return;
    if (aliveBlocks > initialBlocks * 0.25) return;

    const toast = pushToast({
      title: "Manual ball tip",
      message:
        "The Manual ball aims toward your cursor whenever it bounces off a wall. Use it to clean up leftover blocks.",
      glowColor: "rgba(248, 113, 113, 0.55)",
    });

    if (toast) tutorials.manualBallToastShown = true;
  }

  function updateBallContextButton() {
    if (!ballContextBtn) return;
    ballContextBtn.textContent = state.ballContextEnabled ? "Ball Focus: On" : "Ball Focus: Off";
  }

  function updateHpOverlayButton() {
    if (!hpOverlayBtn) return;
    hpOverlayBtn.textContent = state.showHpOverlay ? "Cell HP: On" : "Cell HP: Off";
    hpOverlayBtn.classList.toggle("is-active", state.showHpOverlay);
  }

  function setBallContextType(typeId) {
    state.ballContextType = typeId ?? null;
  }

  function isBallContextEnabled() {
    return state.ballContextEnabled;
  }

  function applyLoadedPlayer(rawPlayer) {
    if (!rawPlayer) return false;
    player = normalizePlayer(rawPlayer);
    ensureCursorState(player);
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    ensureClearsStats();
    ensureStarsState();
    updateGridFromPlayer();
    window.player = player;

    game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
    if (!tryRestoreGridFromPlayerSave()) regenerate();
    if (game.balls.length === 0) {
      spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    }
    ensureCursorBall();
    applyUpgradesToAllBalls();
    return true;
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

  function ensureCursorBall() {
    const existing = game.balls.find((ball) => ball?.data?.isCursorBall);
    if (existing) return existing;

    const type = BALL_TYPES.normal;
    const speedMult = getBallSpeedMultiplier(player, type.id);
    const starDamageMult = getStarUpgradeOwned("damageMulti") ? 2 : 1;
    const baseSpeed = 460 + Math.random() * 80;
    const speed = baseSpeed * speedMult;
    const angle = -Math.PI / 2;

    const ball = Ball.spawn({
      typeId: type.id,
      x: world.width * 0.5,
      y: world.height * 0.85,
      speed,
      angleRad: angle,
      damage: getBallDamageValue(player, type.id, type.baseDamage) * starDamageMult,
      data: {
        isCursorBall: true,
        aimAtCursorOnWall: true,
        baseSpeed,
        baseDamage: type.baseDamage,
      },
    });
    game.balls.push(ball);
    return ball;
  }

  function spawnBallAt(x, y, typeId, { free = false } = {}) {
    const ownedCount = game.balls.reduce(
      (acc, b) => acc + (b.typeId === typeId && !b.data?.isCursorBall ? 1 : 0),
      0
    );
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
      damage: getBallDamageValue(player, type.id, type.baseDamage) * starDamageMult,
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
    const snapshot = buildPlayerSnapshot({ player, game, grid, state });
    const res = savePlayerToStorage(snapshot);
    player = res.player;
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    window.player = player;
    if (!silent) setMessage(res.ok ? "Saved" : "Save failed");
    return player;
  }

  function loadPlayerNow() {
    const loaded = loadPlayerFromStorage();
    if (!loaded) {
      setMessage("No save found");
      return false;
    }
    applyLoadedPlayer(loaded);
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
    ensureCursorBall();
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
    ensureCursorBall();
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

  function ensureTutorialState() {
    if (!player.tutorials || typeof player.tutorials !== "object") {
      player.tutorials = { manualBallToastShown: false };
    }
    player.tutorials.manualBallToastShown = !!player.tutorials.manualBallToastShown;
    return player.tutorials;
  }

  function canStarPrestige() {
    ensureProgress();
    return (player.progress?.level ?? 1) >= STAR_PRESTIGE_LEVEL;
  }

  function starPrestigeNow() {
    ensureStarsState();
    if (!canStarPrestige()) {
      setMessage(`Need Level ${STAR_PRESTIGE_LEVEL}`);
      return false;
    }

    const ok = window.confirm(
      "Star Prestige will reset points/clears/balls and all lower-layer upgrades.\n\nYou will gain +1 Star.\n\nContinue?"
    );
    if (!ok) return false;

    const keepStars = Math.max(0, (player.stars ?? 0) | 0) + 1;
    const keepStarUpgrades = { ...(player.starUpgrades ?? {}) };
    const keepStarStats = { ...(player.starStats ?? {}) };
    const keepManualBallToastShown = !!player.tutorials?.manualBallToastShown;
    keepStarStats.prestiges = Math.max(0, (keepStarStats.prestiges ?? 0) | 0) + 1;
    keepStarStats.earnedTotal = Math.max(0, (keepStarStats.earnedTotal ?? 0) | 0) + 1;
    keepStarStats.lastPrestigeLevel = player.progress?.level ?? null;

    player = normalizePlayer(createDefaultPlayer());
    player.stars = keepStars;
    player.starUpgrades = keepStarUpgrades;
    player.starStats = keepStarStats;
    ensureTutorialState().manualBallToastShown = keepManualBallToastShown;

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
    ensureCursorBall();
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

  function openSettingsModal() {
    if (!settingsModal) return;
    settingsModal.classList.remove("hidden");
    settingsModal.setAttribute("aria-hidden", "false");
  }

  function closeStarsModal() {
    if (!starsModal) return;
    starsModal.classList.add("hidden");
    starsModal.setAttribute("aria-hidden", "true");
  }

  function closeSettingsModal() {
    if (!settingsModal) return;
    settingsModal.classList.add("hidden");
    settingsModal.setAttribute("aria-hidden", "true");
  }

  function openExportImportModal() {
    if (!exportImportModal) return;
    const encoded = encodeSaveString(buildPlayerSnapshot({ player, game, grid, state }));
    if (exportSaveText) {
      exportSaveText.value = encoded;
      exportSaveText.focus();
      exportSaveText.select();
    }
    exportImportModal.classList.remove("hidden");
    exportImportModal.setAttribute("aria-hidden", "false");
  }

  function closeExportImportModal() {
    if (!exportImportModal) return;
    exportImportModal.classList.add("hidden");
    exportImportModal.setAttribute("aria-hidden", "true");
  }

  async function copyExportString() {
    if (!exportSaveText) return;
    const text = exportSaveText.value.trim();
    if (!text) return setMessage("Nothing to copy");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        exportSaveText.select();
        document.execCommand("copy");
      }
      setMessage("Save copied");
    } catch {
      try {
        exportSaveText.select();
        document.execCommand("copy");
        setMessage("Save copied");
      } catch {
        setMessage("Copy failed");
      }
    }
  }

  function importSaveString() {
    const raw = importSaveText?.value?.trim();
    if (!raw) {
      setMessage("Paste a save string first");
      return false;
    }
    const cleaned = raw.replace(/\s+/g, "");
    const parsed = decodeSaveString(cleaned);
    if (!parsed) {
      setMessage("Invalid save string");
      return false;
    }
    const ok = applyLoadedPlayer(parsed);
    if (!ok) {
      setMessage("Import failed");
      return false;
    }
    savePlayerNow({ silent: true });
    if (importSaveText) importSaveText.value = "";
    if (exportSaveText) exportSaveText.value = encodeSaveString(buildPlayerSnapshot({ player, game, grid, state }));
    setMessage("Save imported");
    return true;
  }

  function getMaxDensityLevel() {
    ensureGenerationSettings(player);
    const baseThreshold = player.generation.noiseThreshold;
    const step = CLEARS_SHOP_CONFIG.density.thresholdStep;
    const minThreshold = CLEARS_SHOP_CONFIG.density.minNoiseThreshold;
    if (step <= 0) return 0;
    return Math.max(0, Math.floor((baseThreshold - minThreshold) / step));
  }

  const getPlayer = () => player;
  const ballShopCtx = {
    dom,
    ui,
    world,
    game,
    getPlayer,
    setMessage,
    spawnBallAt,
    getStarUpgradeOwned,
    getPieceUpgradeCapLevel,
    getPieceCountForLevel,
    getCritChanceForLevel,
    getExecuteRatioForLevel,
    setBallContextType,
    isBallContextEnabled,
  };

  saveBtn?.addEventListener("click", savePlayerNow);
  loadBtn?.addEventListener("click", loadPlayerNow);
  hardResetBtn?.addEventListener("click", hardResetNow);
  exportImportBtn?.addEventListener("click", () => {
    closeSettingsModal();
    openExportImportModal();
  });
  clearsShopBtn?.addEventListener("click", openClearsModal);
  starBoardBtn?.addEventListener("click", openStarsModal);
  settingsBtn?.addEventListener("click", openSettingsModal);
  ballContextBtn?.addEventListener("click", () => {
    state.ballContextEnabled = !state.ballContextEnabled;
    if (!state.ballContextEnabled) state.ballContextType = null;
    updateBallContextButton();
  });
  hpOverlayBtn?.addEventListener("click", () => {
    state.showHpOverlay = !state.showHpOverlay;
    updateHpOverlayButton();
  });
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
  settingsCloseBtn?.addEventListener("click", closeSettingsModal);
  settingsModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (target?.dataset?.action === "close") closeSettingsModal();
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
    if (buyStarUpgrade("pieceCount", 1)) setMessage("Unlocked Propagation upgrades");
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
    if (!getStarUpgradeOwned("pieceCount")) return setMessage("Unlock Propagation first");
    if (buyStarUpgradeLevel("pieceCap", 3, 2)) setMessage("Propagation cap increased");
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
  exportImportCloseBtn?.addEventListener("click", closeExportImportModal);
  exportImportModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (target?.dataset?.action === "close") closeExportImportModal();
  });
  exportSaveCopyBtn?.addEventListener("click", () => {
    copyExportString();
  });
  importSaveLoadBtn?.addEventListener("click", () => {
    const ok = importSaveString();
    if (ok) closeExportImportModal();
  });
  window.addEventListener("keydown", (e) => {
    const tagName = e.target?.tagName;
    const isTyping = tagName === "INPUT" || tagName === "TEXTAREA" || e.target?.isContentEditable;
    if (isTyping) return;
    if (e.code === "KeyH") {
      state.showHpOverlay = !state.showHpOverlay;
      updateHpOverlayButton();
      e.preventDefault();
      return;
    }
    if (e.code === "KeyF") {
      state.ballContextEnabled = !state.ballContextEnabled;
      if (!state.ballContextEnabled) state.ballContextType = null;
      updateBallContextButton();
      e.preventDefault();
      return;
    }
    if (e.code === "KeyC") {
      openClearsModal();
      e.preventDefault();
      return;
    }
    if (e.code === "KeyS") {
      if (!starBoardBtn || starBoardBtn.classList.contains("hidden")) return;
      openStarsModal();
      e.preventDefault();
      return;
    }
    if (e.key !== "Escape") return;
    closeClearsShop();
    closeStarBoard();
    closeClearsModal();
    closeStarsModal();
    closeSettingsModal();
    closeExportImportModal();
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

  canvas.addEventListener("pointermove", (e) => {
    const p = screenToWorld(canvas, view, e.clientX, e.clientY);
    world.cursor.x = p.x;
    world.cursor.y = p.y;
    world.cursor.active = p.x >= 0 && p.y >= 0 && p.x <= world.width && p.y <= world.height;
  });
  canvas.addEventListener("pointerleave", () => {
    world.cursor.active = false;
  });

  const resizeObserver = new ResizeObserver(() => updateCanvasView(canvas, world, view));
  resizeObserver.observe(canvas);
  window.addEventListener("resize", () => updateCanvasView(canvas, world, view));
  updateCanvasView(canvas, world, view);
  initBallShopUI(ballShopCtx);
  updateBallContextButton();
  updateHpOverlayButton();
  initTooltips();

  ensureProgress();
  updateGridFromPlayer();
  if (!tryRestoreGridFromPlayerSave()) regenerate();

  game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
  if (game.balls.length === 0) {
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
  }
  ensureCursorBall();
  applyUpgradesToAllBalls();
  pushToast({
    title: "Welcome back",
    message: "This notification will auto close after 7s.",
    glowColor: "rgba(96, 165, 250, 0.55)",
    timeoutMs: 7000,
  });

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

    grid.draw(ctx, { showHp: state.showHpOverlay });
    const showOnlyType = state.ballContextEnabled ? state.ballContextType : null;
    if (showOnlyType) {
      for (const ball of game.balls) if (ball.typeId === showOnlyType) drawManualBallRay(ctx, ball);
      for (const ball of game.balls) if (ball.typeId === showOnlyType) ball.draw(ctx);
    } else {
      for (const ball of game.balls) drawManualBallRay(ctx, ball);
      for (const ball of game.balls) ball.draw(ctx);
    }

    if (pointsEl) {
      pointsEl.innerHTML = `<span class="points-label">Points</span><span class="points-value">${formatInt(
        getPoints(player)
      )}</span>`;
    }

    updateBallShopCards(ballShopCtx);
    maybeShowManualBallToast(aliveBlocks);

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

    if (starResetProgressTrack || starResetProgressFill || starResetProgressText) {
      ensureProgress();
      const level = Math.max(1, player.progress?.level ?? 1);
      const progress = clamp(level / STAR_PRESTIGE_LEVEL, 0, 1);
      const percent = Math.min(100, Math.round(progress * 100));
      if (starResetProgressFill) starResetProgressFill.style.width = `${percent}%`;
      if (starResetProgressFill) starResetProgressFill.classList.toggle("is-ready", level >= STAR_PRESTIGE_LEVEL);
      if (starResetProgressTrack) starResetProgressTrack.classList.toggle("is-ready", level >= STAR_PRESTIGE_LEVEL);
      if (starBoardBtn) starBoardBtn.classList.toggle("is-ready", level >= STAR_PRESTIGE_LEVEL);
      if (starResetProgressText) {
        starResetProgressText.textContent = `Lv ${level} / ${STAR_PRESTIGE_LEVEL} (${percent}%)`;
      }
      if (starResetProgressTrack) {
        starResetProgressTrack.setAttribute("aria-valuenow", String(percent));
        starResetProgressTrack.setAttribute(
          "aria-valuetext",
          `Level ${level} of ${STAR_PRESTIGE_LEVEL} (${percent}%)`
        );
      }
    }

    if (starBoardBtn) {
      ensureStarsState();
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      starBoardBtn.textContent = `Stars (${stars})`;
      const starPrestiges = Math.max(0, (player.starStats?.prestiges ?? 0) | 0);
      const level = player.progress?.level ?? 1;
      const showStarsButton = stars > 0 || starPrestiges > 0 || level > 30;
      starBoardBtn.classList.toggle("hidden", !showStarsButton);
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
      if (starsPrestigeReqEl) starsPrestigeReqEl.textContent = ok ? "Ready" : `Lv ${STAR_PRESTIGE_LEVEL}`;
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
