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
  ensureBallTypeState,
  ensureCursorState,
  getClears,
  getDensityUpgradeCost,
  getDensityUpgradeLevel,
  getGridSizeUpgradeCost,
  getGridSizeUpgradeLevel,
  getBrickHpUpgradeCost,
  getBrickHpEffectLevel,
  getBrickHpUpgradeLevel,
  getPoints,
  loadPlayerFromStorage,
  normalizePlayer,
  savePlayerToStorage,
  trySpendClears,
} from "../player.js";
import { createBallLogic, drawManualBallRay } from "./game/ballLogic.js";
import { createGridFlow } from "./game/gridFlow.js";
import { countAliveBlocks } from "./game/level.js";
import { clamp } from "./game/math.js";
import { ensureProgress as ensureProgressRaw } from "./game/progress.js";
import {
  STAR_BASIC_BALLS_COST,
  STAR_BOARD_WIPE_CHANCE,
  STAR_BOARD_WIPE_COST,
  STAR_BRICK_BOOST_COST,
  STAR_BRICK_BOOST_MAX,
  STAR_BUFFER_OVERFLOW_COST,
  STAR_BUFFER_OVERFLOW_MAX,
  STAR_BUFFER_OVERFLOW_RATE,
  STAR_BETTER_FORMULA_COST,
  STAR_BETTER_FORMULA_MAX,
  STAR_CLEAR_FIRE_SALE_COST,
  STAR_CURSOR_SPLASH_COST,
  STAR_MORE_BOARD_WIPES_COST,
  STAR_MORE_POINTS_COST,
  STAR_MORE_POINTS_MAX,
  STAR_MORE_STARS_COST,
  STAR_PRESTIGE_LEVEL,
  STAR_SPECIAL_CAP_COST,
  STAR_STARBOARD_MULT_COST,
  STAR_TIME_MULT_COST,
  buyStarUpgrade as buyStarUpgradeRaw,
  buyStarUpgradeLevel as buyStarUpgradeLevelRaw,
  ensureStarsState as ensureStarsStateRaw,
  getNextStarGainLevel as getNextStarGainLevelRaw,
  getPieceUpgradeCapLevel as getPieceUpgradeCapLevelRaw,
  getPointsGainMultiplier as getPointsGainMultiplierRaw,
  getStarPrestigeGain as getStarPrestigeGainRaw,
  getStarUpgradeOwned as getStarUpgradeOwnedRaw,
  canStarPrestige as canStarPrestigeRaw,
} from "./game/stars.js";
import { buildPlayerSnapshot, decodeSaveString, encodeSaveString } from "./game/storage.js";
import { getCritChanceForLevel, getExecuteRatioForLevel, getPieceCountForLevel } from "./game/upgradeMath.js";
import { applyWorldTransform, screenToWorld, updateCanvasView } from "./game/view.js";
import { initBallShopUI, updateBallShopCards } from "./ui/ballShop.js";
import { CHANGELOG_LATEST, createChangelogController, populateChangelog } from "./ui/changelog.js";
import { getDomRefs } from "./ui/dom.js";
import { createToastManager } from "./ui/notifications.js";
import {
  getBallCardMinimized as getBallCardMinimizedRaw,
  setBallCardMinimized as setBallCardMinimizedRaw,
  syncUiStateFromPlayer as syncUiStateFromPlayerRaw,
  syncUiStateToPlayer as syncUiStateToPlayerRaw,
} from "./ui/uiState.js";
import { initTooltips } from "./tooltips.js";
import "tippy.js/dist/tippy.css";

export function startApp() {
  const dom = getDomRefs();
  const {
    canvas,
    appVersionEl,
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
    starBoardCountEl,
    starBoardBalanceEl,
    starPieceStateEl,
    starPieceCapStateEl,
    starCritStateEl,
    starExecStateEl,
    starNormalCapStateEl,
    starClearsLogStateEl,
    starDmgMultStateEl,
    starPersistStateEl,
    starDpsStateEl,
    starAdvPersistStateEl,
    starCursorSplashStateEl,
    starHeavyStateEl,
    starCollapseStateEl,
    starBallcountStateEl,
    starBetterFormulaStateEl,
    starBasicBallsStateEl,
    starBrickBoostStateEl,
    starMorePointsStateEl,
    starBufferFlowStateEl,
    starMoreStarsStateEl,
    starBoardWipeStateEl,
    starMoreBoardWipesStateEl,
    starClearFireSaleStateEl,
    starStarboardMultStateEl,
    starTimeMultStateEl,
    starSpecialCapStateEl,
    starTier2Box,
    starTier3Box,
    starTier4Box,
    starTier5Box,
    starPieceBuyBtn,
    starPieceCapBuyBtn,
    starCritBuyBtn,
    starExecBuyBtn,
    starNormalCapBuyBtn,
    starClearsLogBuyBtn,
    starDmgMultBuyBtn,
    starPersistBuyBtn,
    starDpsBuyBtn,
    starAdvPersistBuyBtn,
    starCursorSplashBuyBtn,
    starHeavyBuyBtn,
    starCollapseBuyBtn,
    starBallcountBuyBtn,
    starBetterFormulaBuyBtn,
    starBasicBallsBuyBtn,
    starBrickBoostBuyBtn,
    starMorePointsBuyBtn,
    starBufferFlowBuyBtn,
    starMoreStarsBuyBtn,
    starBoardWipeBuyBtn,
    starMoreBoardWipesBuyBtn,
    starClearFireSaleBuyBtn,
    starStarboardMultBuyBtn,
    starTimeMultBuyBtn,
    starSpecialCapBuyBtn,
    starsModal,
    starsModalCloseBtn,
    starsBalanceEl,
    starsPrestigeBtn,
    starsPrestigeReqEl,
    starsStatsLine1El,
    starsStatsLine2El,
    starsStatsLine3El,
    starsStatsLine4El,
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
    changelogModal,
    changelogVersionEl,
    changelogListEl,
  } = dom;

  const DPS_WINDOW_MS = 10000;
  const DPS_WINDOW_SECONDS = DPS_WINDOW_MS / 1000;

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
  const dpsStats = { damageByType: {}, dpsByType: {} };
  for (const typeId of Object.keys(BALL_TYPES)) {
    dpsStats.damageByType[typeId] = 0;
    dpsStats.dpsByType[typeId] = 0;
  }
  grid.onCellDestroyed = (_index, sourceTypeId) => {
    if (state.boardWipeTriggered) return;
    if (!getStarUpgradeOwned("boardWipe")) return;
    const chance = Math.min(1, STAR_BOARD_WIPE_CHANCE * (getStarUpgradeOwned("moreBoardWipes") ? 3 : 1));
    if (chance <= 0) return;
    if (Math.random() >= chance) return;
    state.boardWipeTriggered = true;
    grid.hp.fill(0);
  };

  const state = {
    uiMessage: null,
    uiMessageUntil: 0,
    initialBlocks: 0,
    showHpOverlay: false,
    ballContextEnabled: false,
    ballContextType: null,
    boardWipeTriggered: false,
  };

  let player = loadPlayerFromStorage() ?? createDefaultPlayer();
  player = normalizePlayer(player);
  ensureCursorState(player);
  ensureGenerationSettings(player);
  ensureClearsUpgrades(player);
  syncUiStateFromPlayer();
  window.player = player;

  const game = {
    balls: [],
  };
  window.game = game;

  const ui = {
    ballCards: new Map(),
  };
  const getPlayer = () => player;
  const { pushToast } = createToastManager(toastContainer);
  const { openChangelogModal, scheduleChangelogClose } = createChangelogController({
    appVersionEl,
    changelogModal,
  });
  const { updateGridFromPlayer, regenerate, tryRestoreGridFromPlayerSave, getMaxDensityLevel } = createGridFlow({
    getPlayer,
    grid,
    world,
    state,
  });
  const { applyUpgradesToAllBalls, ensureCursorBall, ensureHeavyBall, spawnBallAt } = createBallLogic({
    getPlayer,
    game,
    world,
    setMessage,
  });

  function setMessage(msg, seconds = 1.6) {
    state.uiMessage = msg;
    state.uiMessageUntil = performance.now() + seconds * 1000;
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
    syncUiStateFromPlayer();
    updateBallContextButton();
    updateHpOverlayButton();
    updateGridFromPlayer();
    window.player = player;

    game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
    if (!tryRestoreGridFromPlayerSave()) regenerate();
    if (game.balls.length === 0) {
      spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    }
    ensureCursorBall();
    ensureHeavyBall();
    applyUpgradesToAllBalls();
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
    syncUiStateFromPlayer();
    updateBallContextButton();
    updateHpOverlayButton();
    updateGridFromPlayer();
    window.player = player;
    game.balls = [];
    regenerate({ reseed: true });
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    ensureCursorBall();
    ensureHeavyBall();
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
      preservedBallTypes.normal = {
        damageLevel: s.damageLevel,
        speedLevel: s.speedLevel,
        rangeLevel: s.rangeLevel,
        sizeLevel: s.sizeLevel,
        pieceLevel: s.pieceLevel,
        critLevel: s.critLevel,
        executionLevel: s.executionLevel,
      };
    }
    if (keepOthers) {
      for (const typeId of Object.keys(BALL_TYPES)) {
        if (typeId === "normal") continue;
        const s = ensureBallTypeState(player, typeId);
        preservedBallTypes[typeId] = {
          damageLevel: s.damageLevel,
          speedLevel: s.speedLevel,
          rangeLevel: s.rangeLevel,
          sizeLevel: s.sizeLevel,
          pieceLevel: s.pieceLevel,
          critLevel: s.critLevel,
          executionLevel: s.executionLevel,
        };
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

    const keepBalls = getStarUpgradeOwned("ballcountPersist");
    const preservedBalls = keepBalls
      ? game.balls.filter((ball) => !ball.data?.isCursorBall)
      : [];

    player.ballTypes = preservedBallTypes;
    ensureCursorState(player).level = 0;
    game.balls = keepBalls ? preservedBalls : [];

    ensureProgress();
    player.progress.level = 1;
    updateGridFromPlayer();
    regenerate();
    if (!keepBalls || preservedBalls.length === 0) {
      spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    }
    ensureCursorBall();
    ensureHeavyBall();
    applyUpgradesToAllBalls();

    window.player = player;
    setMessage("Prestiged");
    return true;
  }


  function ensureProgress() {
    return ensureProgressRaw(player);
  }

  function ensureStarsState() {
    return ensureStarsStateRaw(player);
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

  function syncUiStateFromPlayer() {
    return syncUiStateFromPlayerRaw(player, state);
  }

  function syncUiStateToPlayer() {
    return syncUiStateToPlayerRaw(player, state);
  }

  function getBallCardMinimized(typeId) {
    return getBallCardMinimizedRaw(player, typeId);
  }

  function setBallCardMinimized(typeId, minimized) {
    return setBallCardMinimizedRaw(player, typeId, minimized);
  }

  function getPieceUpgradeCapLevel() {
    return getPieceUpgradeCapLevelRaw(player);
  }

  function getStarUpgradeOwned(key) {
    return getStarUpgradeOwnedRaw(player, key);
  }

  function getStarPrestigeGain() {
    return getStarPrestigeGainRaw(player);
  }

  function getNextStarGainLevel(currentGain) {
    return getNextStarGainLevelRaw(player, currentGain);
  }

  function canStarPrestige() {
    return canStarPrestigeRaw(player);
  }

  function starPrestigeNow() {
    ensureStarsState();
    if (!canStarPrestige()) {
      setMessage(`Need Level ${STAR_PRESTIGE_LEVEL}`);
      return false;
    }

    const gain = getStarPrestigeGain();
    const keepBalls = getStarUpgradeOwned("ballcountPersist");
    const resetCopy = keepBalls
      ? "Star Prestige will reset points/clears and all lower-layer upgrades.\n\nYour balls will persist (Ballcount Persist)."
      : "Star Prestige will reset points/clears/balls and all lower-layer upgrades.";
    const ok = window.confirm(
      `${resetCopy}\n\nYou will gain +${gain} Star${gain === 1 ? "" : "s"}.\n\nContinue?`
    );
    if (!ok) return false;

    const keepStars = Math.max(0, (player.stars ?? 0) | 0) + gain;
    const keepStarUpgrades = { ...(player.starUpgrades ?? {}) };
    const keepStarStats = { ...(player.starStats ?? {}) };
    const keepManualBallToastShown = !!player.tutorials?.manualBallToastShown;
    const keepUiState = player.ui && typeof player.ui === "object" ? { ...player.ui } : null;
    const preservedBalls = keepBalls
      ? game.balls.filter((ball) => !ball.data?.isCursorBall)
      : [];
    const keepNormal = getStarUpgradeOwned("persistence");
    const keepOthers = getStarUpgradeOwned("advancedPersistence");
    const preservedBallTypes = {};
    if (keepNormal) {
      const s = ensureBallTypeState(player, "normal");
      preservedBallTypes.normal = {
        damageLevel: s.damageLevel,
        speedLevel: s.speedLevel,
        rangeLevel: s.rangeLevel,
        sizeLevel: s.sizeLevel,
        pieceLevel: s.pieceLevel,
        critLevel: s.critLevel,
        executionLevel: s.executionLevel,
      };
    }
    if (keepOthers) {
      for (const typeId of Object.keys(BALL_TYPES)) {
        if (typeId === "normal") continue;
        const s = ensureBallTypeState(player, typeId);
        preservedBallTypes[typeId] = {
          damageLevel: s.damageLevel,
          speedLevel: s.speedLevel,
          rangeLevel: s.rangeLevel,
          sizeLevel: s.sizeLevel,
          pieceLevel: s.pieceLevel,
          critLevel: s.critLevel,
          executionLevel: s.executionLevel,
        };
      }
    }
    keepStarStats.prestiges = Math.max(0, (keepStarStats.prestiges ?? 0) | 0) + 1;
    keepStarStats.earnedTotal = Math.max(0, (keepStarStats.earnedTotal ?? 0) | 0) + gain;
    keepStarStats.lastPrestigeLevel = player.progress?.level ?? null;
    keepStarStats.lastPrestigeAt = Date.now();

    player = normalizePlayer(createDefaultPlayer());
    player.stars = keepStars;
    player.starUpgrades = keepStarUpgrades;
    player.starStats = keepStarStats;
    player.ballTypes = preservedBallTypes;
    ensureTutorialState().manualBallToastShown = keepManualBallToastShown;
    if (keepUiState) player.ui = keepUiState;
    syncUiStateFromPlayer();
    updateBallContextButton();
    updateHpOverlayButton();

    ensureCursorState(player).level = 0;
    ensureGenerationSettings(player);
    ensureClearsUpgrades(player);
    ensureProgress();
    player.progress.level = 1;
    player.progress.masterSeed = (Math.random() * 2 ** 32) >>> 0;

    updateGridFromPlayer();
    window.player = player;

    game.balls = keepBalls ? preservedBalls : [];
    regenerate();
    if (!keepBalls || preservedBalls.length === 0) {
      spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    }
    ensureCursorBall();
    ensureHeavyBall();
    applyUpgradesToAllBalls();

    setMessage(`Gained +${gain} Star${gain === 1 ? "" : "s"}`);
    savePlayerNow({ silent: true });
    return true;
  }

  function getPointsGainMultiplier() {
    return getPointsGainMultiplierRaw(player);
  }

  function buyStarUpgrade(key, cost) {
    return buyStarUpgradeRaw(player, key, cost);
  }

  function buyStarUpgradeLevel(key, cost, maxLevel) {
    return buyStarUpgradeLevelRaw(player, key, cost, maxLevel);
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

  const getBallDps = (typeId) => dpsStats.dpsByType[typeId] ?? 0;
  const ballShopCtx = {
    dom,
    ui,
    world,
    game,
    getPlayer,
    setMessage,
    spawnBallAt,
    applyUpgradesToAllBalls,
    getStarUpgradeOwned,
    getPieceUpgradeCapLevel,
    getPieceCountForLevel,
    getCritChanceForLevel,
    getExecuteRatioForLevel,
    getBallDps,
    getBallCardMinimized,
    setBallCardMinimized,
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
    syncUiStateToPlayer();
    updateBallContextButton();
  });
  hpOverlayBtn?.addEventListener("click", () => {
    state.showHpOverlay = !state.showHpOverlay;
    syncUiStateToPlayer();
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
  appVersionEl?.addEventListener("mouseenter", openChangelogModal);
  appVersionEl?.addEventListener("mouseleave", scheduleChangelogClose);
  appVersionEl?.addEventListener("focus", openChangelogModal);
  appVersionEl?.addEventListener("blur", scheduleChangelogClose);
  changelogModal?.addEventListener("mouseenter", openChangelogModal);
  changelogModal?.addEventListener("mouseleave", scheduleChangelogClose);

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
  starNormalCapBuyBtn?.addEventListener("click", () => {
    if (buyStarUpgradeLevel("normalCap", 1, 2)) setMessage("Normal ball cap increased");
    else setMessage("Need 1 Star (or maxed)");
  });
  const anyTier1Bought = () => {
    ensureStarsState();
    return (
      getStarUpgradeOwned("pieceCount") ||
      getStarUpgradeOwned("criticalHits") ||
      getStarUpgradeOwned("execution") ||
      (player.starUpgrades?.normalCap ?? 0) > 0 ||
      getStarUpgradeOwned("persistence")
    );
  };
  const anyTier2Bought = () => {
    ensureStarsState();
    const pieceCap = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
    return (
      pieceCap > 0 ||
      getStarUpgradeOwned("clearsLogMult") ||
      getStarUpgradeOwned("damageMulti") ||
      getStarUpgradeOwned("cursorSplash") ||
      getStarUpgradeOwned("advancedPersistence") ||
      (player.starUpgrades?.brickHpBoost ?? 0) > 0
    );
  };
  const anyTier3Bought = () =>
    getStarUpgradeOwned("heavyBall") ||
    getStarUpgradeOwned("starCollapse") ||
    getStarUpgradeOwned("timeStarMult") ||
    getStarUpgradeOwned("specialCap") ||
    getStarUpgradeOwned("betterBasicBalls") ||
    (player.starUpgrades?.morePoints ?? 0) > 0;
  const anyTier4Bought = () =>
    getStarUpgradeOwned("ballcountPersist") ||
    (player.starUpgrades?.betterFormula ?? 0) > 0 ||
    (player.starUpgrades?.bufferOverflow ?? 0) > 0 ||
    getStarUpgradeOwned("boardWipe");
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
  starCursorSplashBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (buyStarUpgrade("cursorSplash", STAR_CURSOR_SPLASH_COST)) {
      ensureCursorBall();
      setMessage("Manual Splash Ball unlocked");
    } else setMessage(`Need ${STAR_CURSOR_SPLASH_COST} Stars`);
  });
  starPersistBuyBtn?.addEventListener("click", () => {
    if (buyStarUpgrade("persistence", 1)) setMessage("Persistance unlocked");
    else setMessage("Need 1 Star");
  });
  starDpsBuyBtn?.addEventListener("click", () => {
    if (buyStarUpgrade("dpsStats", 1)) setMessage("DPS stats unlocked");
    else setMessage("Need 1 Star");
  });
  starAdvPersistBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (buyStarUpgrade("advancedPersistence", 3)) setMessage("Advanced Persistance unlocked");
    else setMessage("Need 3 Stars");
  });
  starBrickBoostBuyBtn?.addEventListener("click", () => {
    if (!anyTier1Bought()) return setMessage("Buy a Tier 1 upgrade first");
    if (buyStarUpgradeLevel("brickHpBoost", STAR_BRICK_BOOST_COST, STAR_BRICK_BOOST_MAX))
      setMessage("Weaker Bricks boost upgraded");
    else setMessage(`Need ${STAR_BRICK_BOOST_COST} Stars (or maxed)`);
  });
  starHeavyBuyBtn?.addEventListener("click", () => {
    if (!anyTier2Bought()) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgrade("heavyBall", 5)) {
      ensureHeavyBall();
      setMessage("Heavy ball unlocked");
    } else setMessage("Need 5 Stars");
  });
  starCollapseBuyBtn?.addEventListener("click", () => {
    if (!anyTier2Bought()) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgrade("starCollapse", 5)) setMessage("Star Collapse unlocked");
    else setMessage("Need 5 Stars");
  });
  starTimeMultBuyBtn?.addEventListener("click", () => {
    if (!anyTier2Bought()) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgrade("timeStarMult", STAR_TIME_MULT_COST)) setMessage("Time Star Mult unlocked");
    else setMessage(`Need ${STAR_TIME_MULT_COST} Stars`);
  });
  starSpecialCapBuyBtn?.addEventListener("click", () => {
    if (!anyTier2Bought()) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgrade("specialCap", STAR_SPECIAL_CAP_COST)) setMessage("Special Ball Cap unlocked");
    else setMessage(`Need ${STAR_SPECIAL_CAP_COST} Stars`);
  });
  starMorePointsBuyBtn?.addEventListener("click", () => {
    if (!anyTier2Bought()) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgradeLevel("morePoints", STAR_MORE_POINTS_COST, STAR_MORE_POINTS_MAX)) {
      setMessage("More Points upgraded");
    } else setMessage(`Need ${STAR_MORE_POINTS_COST} Stars (or maxed)`);
  });
  starBufferFlowBuyBtn?.addEventListener("click", () => {
    if (!anyTier3Bought()) return setMessage("Buy a Tier 3 upgrade first");
    if (buyStarUpgradeLevel("bufferOverflow", STAR_BUFFER_OVERFLOW_COST, STAR_BUFFER_OVERFLOW_MAX)) {
      setMessage("Buffer Overflow upgraded");
    } else setMessage(`Need ${STAR_BUFFER_OVERFLOW_COST} Stars (or maxed)`);
  });
  starBoardWipeBuyBtn?.addEventListener("click", () => {
    if (!anyTier3Bought()) return setMessage("Buy a Tier 3 upgrade first");
    if (buyStarUpgrade("boardWipe", STAR_BOARD_WIPE_COST)) setMessage("Board Wipe unlocked");
    else setMessage(`Need ${STAR_BOARD_WIPE_COST} Stars`);
  });
  starMoreStarsBuyBtn?.addEventListener("click", () => {
    if (!anyTier4Bought()) return setMessage("Buy a Tier 4 upgrade first");
    if (buyStarUpgrade("moreStars", STAR_MORE_STARS_COST)) setMessage("More Stars unlocked");
    else setMessage(`Need ${STAR_MORE_STARS_COST} Stars`);
  });
  starMoreBoardWipesBuyBtn?.addEventListener("click", () => {
    if (!anyTier4Bought()) return setMessage("Buy a Tier 4 upgrade first");
    if (buyStarUpgrade("moreBoardWipes", STAR_MORE_BOARD_WIPES_COST)) setMessage("More Board Wipes unlocked");
    else setMessage(`Need ${STAR_MORE_BOARD_WIPES_COST} Stars`);
  });
  starClearFireSaleBuyBtn?.addEventListener("click", () => {
    if (!anyTier4Bought()) return setMessage("Buy a Tier 4 upgrade first");
    if (buyStarUpgrade("clearFireSale", STAR_CLEAR_FIRE_SALE_COST)) setMessage("Clear Fire Sale unlocked");
    else setMessage(`Need ${STAR_CLEAR_FIRE_SALE_COST} Stars`);
  });
  starStarboardMultBuyBtn?.addEventListener("click", () => {
    if (!anyTier4Bought()) return setMessage("Buy a Tier 4 upgrade first");
    if (buyStarUpgrade("starboardMultiplier", STAR_STARBOARD_MULT_COST)) setMessage("Starboard Mult unlocked");
    else setMessage(`Need ${STAR_STARBOARD_MULT_COST} Stars`);
  });
  starBasicBallsBuyBtn?.addEventListener("click", () => {
    if (!anyTier2Bought()) return setMessage("Buy a Tier 2 upgrade first");
    if (buyStarUpgrade("betterBasicBalls", STAR_BASIC_BALLS_COST)) {
      applyUpgradesToAllBalls();
      setMessage("Better Basic Balls unlocked");
    } else setMessage(`Need ${STAR_BASIC_BALLS_COST} Stars`);
  });
  starBallcountBuyBtn?.addEventListener("click", () => {
    if (!anyTier3Bought()) return setMessage("Buy a Tier 3 upgrade first");
    if (buyStarUpgrade("ballcountPersist", 10)) setMessage("Balls persist unlocked");
    else setMessage("Need 10 Stars");
  });
  starBetterFormulaBuyBtn?.addEventListener("click", () => {
    if (!anyTier3Bought()) return setMessage("Buy a Tier 3 upgrade first");
    if (buyStarUpgradeLevel("betterFormula", STAR_BETTER_FORMULA_COST, STAR_BETTER_FORMULA_MAX))
      setMessage("Better Star Formula upgraded");
    else setMessage(`Need ${STAR_BETTER_FORMULA_COST} Stars (or maxed)`);
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
      syncUiStateToPlayer();
      updateHpOverlayButton();
      e.preventDefault();
      return;
    }
    if (e.code === "KeyF") {
      state.ballContextEnabled = !state.ballContextEnabled;
      if (!state.ballContextEnabled) state.ballContextType = null;
      syncUiStateToPlayer();
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
  populateChangelog({ appVersionEl, changelogVersionEl, changelogListEl }, CHANGELOG_LATEST);
  initTooltips();

  ensureProgress();
  updateGridFromPlayer();
  if (!tryRestoreGridFromPlayerSave()) regenerate();

  game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
  if (game.balls.length === 0) {
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
  }
  ensureCursorBall();
  ensureHeavyBall();
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
  setInterval(() => {
    for (const typeId of Object.keys(BALL_TYPES)) {
      const damage = dpsStats.damageByType[typeId] ?? 0;
      dpsStats.dpsByType[typeId] = damage / DPS_WINDOW_SECONDS;
      dpsStats.damageByType[typeId] = 0;
    }
  }, DPS_WINDOW_MS);

  let lastT = performance.now();
  let fpsSmoothed = 60;

  function frame(t) {
    state.boardWipeTriggered = false;
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;

    fpsSmoothed = fpsSmoothed * 0.93 + (1 / Math.max(1e-6, dt)) * 0.07;

    applyUpgradesToAllBalls();

    let damageDealt = 0;
    for (const ball of game.balls) {
      const dealt = ball.step(dt, world, grid);
      damageDealt += dealt;
      if (dealt > 0) {
        dpsStats.damageByType[ball.typeId] = (dpsStats.damageByType[ball.typeId] ?? 0) + dealt;
      }
    }
    if (damageDealt > 0) {
      const rounded = Math.round(damageDealt * 1000) / 1000;
      const mult = getPointsGainMultiplier();
      const boosted = Math.round(rounded * mult * 1000) / 1000;
      addPoints(player, D(boosted));
    }

    let aliveBlocks = countAliveBlocks(grid);
    if (aliveBlocks === 0) {
      ensureProgress();
      player.progress.level += 1;
      ensureClearsStats();
      player.clearsBuffered = Math.max(0, (player.clearsBuffered ?? 0) | 0) + 1;
      player.clearsBufferedBricks = Math.max(0, (player.clearsBufferedBricks ?? 0) | 0) + (state.initialBlocks | 0);
      const overflowLevel = Math.max(
        0,
        Math.min(STAR_BUFFER_OVERFLOW_MAX, (player.starUpgrades?.bufferOverflow ?? 0) | 0)
      );
      if (overflowLevel > 0) {
        const bufferNow = Math.max(0, (player.clearsBuffered ?? 0) | 0);
        const bufferBricks = Math.max(0, (player.clearsBufferedBricks ?? 0) | 0);
        const hasLogBoost = getStarUpgradeOwned("clearsLogMult");
        const mult = hasLogBoost ? Math.max(1, Math.log(Math.max(1, bufferBricks))) : 1;
        const bufferScore = bufferNow > 0 ? Math.max(0, Math.floor(bufferNow * mult)) : 0;
        const bonus = Math.floor(bufferScore * STAR_BUFFER_OVERFLOW_RATE * overflowLevel);
        if (bonus > 0) addClears(player, D(bonus));
      }
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
      for (const ball of game.balls) if (ball.typeId === showOnlyType) drawManualBallRay(ctx, ball, world, grid);
      for (const ball of game.balls) if (ball.typeId === showOnlyType) ball.draw(ctx);
    } else {
      for (const ball of game.balls) drawManualBallRay(ctx, ball, world, grid);
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
      ensureClearsStats();
      const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
      clearsShopBtn.textContent = `Clears (${formatInt(clearsNow)})`;
      const bestGain = Math.max(0, (player.clearsStats?.bestGain ?? 0) | 0);
      clearsShopBtn.classList.toggle("is-ready", buffered > bestGain);
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
        const startHp = Math.max(1, worldLevel - getBrickHpEffectLevel(player));
        clearsHpInfoEl.textContent = `Starting HP at Level ${worldLevel}: ${startHp}`;
      }
    }

    if (statsEl) {
      const msg = performance.now() < state.uiMessageUntil ? ` | ${state.uiMessage}` : "";
      statsEl.textContent = `Blocks: ${aliveBlocks} | Balls: ${game.balls.length} | FPS: ${fpsSmoothed.toFixed(0)}${msg}`;
    }

    if (hudLevelEl) {
      ensureStarsState();
      const level = player.progress?.level ?? 1;
      const clears = formatInt(getClears(player));
      const buffered = Math.max(0, (player.clearsBuffered ?? 0) | 0);
      const bufferedBricks = Math.max(0, (player.clearsBufferedBricks ?? 0) | 0);
      const hasLogBoost = getStarUpgradeOwned("clearsLogMult");
      const mult = hasLogBoost ? Math.max(1, Math.log(Math.max(1, bufferedBricks))) : 1;
      const gain = buffered > 0 ? Math.max(0, Math.floor(buffered * mult)) : 0;
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      const clearsLabel = gain > 0 ? `${clears} (+${gain})` : clears;
      hudLevelEl.textContent = `Level ${level} | Clears ${clearsLabel} | Stars ${stars}`;
    }

    if (starResetProgressTrack || starResetProgressFill || starResetProgressText) {
      ensureProgress();
      const level = Math.max(1, player.progress?.level ?? 1);
      const progress = clamp(level / STAR_PRESTIGE_LEVEL, 0, 1);
      const percent = Math.min(100, Math.round(progress * 100));
      const hasStarCollapse = getStarUpgradeOwned("starCollapse");
      const hasMoreStars = getStarUpgradeOwned("moreStars");
      const showGain = hasStarCollapse && level >= STAR_PRESTIGE_LEVEL;
      const gain = showGain ? getStarPrestigeGain() : 1;
      const nextGainLevel = showGain && !hasMoreStars ? getNextStarGainLevel(gain) : null;
      if (starResetProgressFill) starResetProgressFill.style.width = `${percent}%`;
      if (starResetProgressFill) starResetProgressFill.classList.toggle("is-ready", level >= STAR_PRESTIGE_LEVEL);
      if (starResetProgressTrack) starResetProgressTrack.classList.toggle("is-ready", level >= STAR_PRESTIGE_LEVEL);
      if (starBoardBtn) starBoardBtn.classList.toggle("is-ready", level >= STAR_PRESTIGE_LEVEL);
      if (starResetProgressText) {
        const nextLabel = nextGainLevel ? ` | Next at Lv ${nextGainLevel}` : "";
        starResetProgressText.textContent = showGain
          ? `Star Gain: +${gain}${nextLabel}`
          : `Lv ${level} / ${STAR_PRESTIGE_LEVEL} (${percent}%)`;
      }
      if (starResetProgressTrack) {
        starResetProgressTrack.setAttribute("aria-valuenow", String(percent));
        starResetProgressTrack.setAttribute(
          "aria-valuetext",
          showGain
            ? `Star gain +${gain}${nextGainLevel ? `, next at level ${nextGainLevel}` : ""}`
            : `Level ${level} of ${STAR_PRESTIGE_LEVEL} (${percent}%)`
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
    if (starBoardCountEl) {
      const stars = Math.max(0, (player.stars ?? 0) | 0);
      starBoardCountEl.textContent = `Stars: ${stars}`;
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

    if (
      starsBalanceEl ||
      starsPrestigeBtn ||
      starsPrestigeReqEl ||
      starsStatsLine1El ||
      starsStatsLine2El ||
      starsStatsLine3El ||
      starsStatsLine4El
    ) {
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
      if (starsStatsLine4El) {
        const lastAt = player.starStats?.lastPrestigeAt;
        const elapsedMs = Number.isFinite(lastAt) ? Math.max(0, Date.now() - lastAt) : null;
        const totalSec = elapsedMs === null ? null : Math.floor(elapsedMs / 1000);
        const hours = totalSec === null ? 0 : Math.floor(totalSec / 3600);
        const mins = totalSec === null ? 0 : Math.floor((totalSec % 3600) / 60);
        const secs = totalSec === null ? 0 : totalSec % 60;
        let text = "-";
        if (totalSec !== null) {
          if (hours > 0) text = `${hours}h ${mins}m`;
          else if (mins > 0) text = `${mins}m ${secs}s`;
          else text = `${secs}s`;
        }
        starsStatsLine4El.textContent = text;
      }
    }

    const setStarOwned = (el, owned) => {
      if (!el) return;
      const row = el.closest(".stars-upgrade-row");
      if (row) {
        row.classList.toggle("is-owned", owned);
        row.classList.toggle("is-unowned", !owned);
      }
      el.textContent = owned ? "OK" : "";
    };
    const setStarLevelOwned = (el, owned) => {
      if (!el) return;
      const row = el.closest(".stars-upgrade-row");
      if (!row) return;
      row.classList.toggle("is-owned", owned);
      if (!owned) row.classList.remove("is-unowned");
    };
    setStarOwned(starPieceStateEl, getStarUpgradeOwned("pieceCount"));
    if (starPieceCapStateEl) {
      ensureStarsState();
      const lv = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
      const max = 2;
      starPieceCapStateEl.textContent = `${Math.min(max, lv)}/${max}`;
      setStarLevelOwned(starPieceCapStateEl, lv >= max);
    }
    setStarOwned(starCritStateEl, getStarUpgradeOwned("criticalHits"));
    setStarOwned(starExecStateEl, getStarUpgradeOwned("execution"));
    if (starNormalCapStateEl) {
      ensureStarsState();
      const lv = Math.max(0, (player.starUpgrades?.normalCap ?? 0) | 0);
      const max = 2;
      starNormalCapStateEl.textContent = `${Math.min(max, lv)}/${max}`;
      setStarLevelOwned(starNormalCapStateEl, lv >= max);
    }
    setStarOwned(starClearsLogStateEl, getStarUpgradeOwned("clearsLogMult"));
    setStarOwned(starDmgMultStateEl, getStarUpgradeOwned("damageMulti"));
    setStarOwned(starPersistStateEl, getStarUpgradeOwned("persistence"));
    setStarOwned(starDpsStateEl, getStarUpgradeOwned("dpsStats"));
    setStarOwned(starCursorSplashStateEl, getStarUpgradeOwned("cursorSplash"));
    setStarOwned(starAdvPersistStateEl, getStarUpgradeOwned("advancedPersistence"));
    setStarOwned(starHeavyStateEl, getStarUpgradeOwned("heavyBall"));
    setStarOwned(starCollapseStateEl, getStarUpgradeOwned("starCollapse"));
    setStarOwned(starTimeMultStateEl, getStarUpgradeOwned("timeStarMult"));
    setStarOwned(starSpecialCapStateEl, getStarUpgradeOwned("specialCap"));
    setStarOwned(starBallcountStateEl, getStarUpgradeOwned("ballcountPersist"));
    setStarOwned(starBasicBallsStateEl, getStarUpgradeOwned("betterBasicBalls"));
    if (starMorePointsStateEl) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_MORE_POINTS_MAX, (player.starUpgrades?.morePoints ?? 0) | 0));
      starMorePointsStateEl.textContent = `${lv}/${STAR_MORE_POINTS_MAX}`;
      setStarLevelOwned(starMorePointsStateEl, lv >= STAR_MORE_POINTS_MAX);
    }
    if (starBufferFlowStateEl) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_BUFFER_OVERFLOW_MAX, (player.starUpgrades?.bufferOverflow ?? 0) | 0));
      starBufferFlowStateEl.textContent = `${lv}/${STAR_BUFFER_OVERFLOW_MAX}`;
      setStarLevelOwned(starBufferFlowStateEl, lv >= STAR_BUFFER_OVERFLOW_MAX);
    }
    setStarOwned(starBoardWipeStateEl, getStarUpgradeOwned("boardWipe"));
    setStarOwned(starMoreStarsStateEl, getStarUpgradeOwned("moreStars"));
    setStarOwned(starMoreBoardWipesStateEl, getStarUpgradeOwned("moreBoardWipes"));
    setStarOwned(starClearFireSaleStateEl, getStarUpgradeOwned("clearFireSale"));
    setStarOwned(starStarboardMultStateEl, getStarUpgradeOwned("starboardMultiplier"));
    if (starBrickBoostStateEl) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_BRICK_BOOST_MAX, (player.starUpgrades?.brickHpBoost ?? 0) | 0));
      starBrickBoostStateEl.textContent = `${lv}/${STAR_BRICK_BOOST_MAX}`;
      setStarLevelOwned(starBrickBoostStateEl, lv >= STAR_BRICK_BOOST_MAX);
    }
    if (starBetterFormulaStateEl) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_BETTER_FORMULA_MAX, (player.starUpgrades?.betterFormula ?? 0) | 0));
      starBetterFormulaStateEl.textContent = `${lv}/${STAR_BETTER_FORMULA_MAX}`;
      setStarLevelOwned(starBetterFormulaStateEl, lv >= STAR_BETTER_FORMULA_MAX);
    }

    const starsNow = Math.max(0, (player.stars ?? 0) | 0);
    if (starPieceBuyBtn) starPieceBuyBtn.disabled = getStarUpgradeOwned("pieceCount") || starsNow < 1;
    if (starCritBuyBtn) starCritBuyBtn.disabled = getStarUpgradeOwned("criticalHits") || starsNow < 1;
    if (starExecBuyBtn) starExecBuyBtn.disabled = getStarUpgradeOwned("execution") || starsNow < 1;
    if (starNormalCapBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, (player.starUpgrades?.normalCap ?? 0) | 0);
      starNormalCapBuyBtn.disabled = lv >= 2 || starsNow < 1;
    }

    const tier2Locked = !anyTier1Bought();
    if (starTier2Box) {
      starTier2Box.classList.remove("hidden");
      starTier2Box.classList.toggle("is-locked", tier2Locked);
    }
    const tier3Locked = !anyTier2Bought();
    if (starTier3Box) {
      starTier3Box.classList.remove("hidden");
      starTier3Box.classList.toggle("is-locked", tier3Locked);
    }
    const tier4Locked = !anyTier3Bought();
    if (starTier4Box) {
      starTier4Box.classList.remove("hidden");
      starTier4Box.classList.toggle("is-locked", tier4Locked);
    }
    const tier5Locked = !anyTier4Bought();
    if (starTier5Box) {
      starTier5Box.classList.remove("hidden");
      starTier5Box.classList.toggle("is-locked", tier5Locked);
    }
    if (starPieceCapBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, (player.starUpgrades?.pieceCap ?? 0) | 0);
      starPieceCapBuyBtn.disabled = tier2Locked || lv >= 2 || starsNow < 3;
    }
    if (starClearsLogBuyBtn)
      starClearsLogBuyBtn.disabled = tier2Locked || getStarUpgradeOwned("clearsLogMult") || starsNow < 3;
    if (starDmgMultBuyBtn) starDmgMultBuyBtn.disabled = tier2Locked || getStarUpgradeOwned("damageMulti") || starsNow < 3;
    if (starCursorSplashBuyBtn)
      starCursorSplashBuyBtn.disabled =
        tier2Locked || getStarUpgradeOwned("cursorSplash") || starsNow < STAR_CURSOR_SPLASH_COST;
    if (starPersistBuyBtn) starPersistBuyBtn.disabled = getStarUpgradeOwned("persistence") || starsNow < 1;
    if (starDpsBuyBtn) starDpsBuyBtn.disabled = getStarUpgradeOwned("dpsStats") || starsNow < 1;
    if (starAdvPersistBuyBtn)
      starAdvPersistBuyBtn.disabled =
        tier2Locked || getStarUpgradeOwned("advancedPersistence") || starsNow < 3;
    if (starBrickBoostBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_BRICK_BOOST_MAX, (player.starUpgrades?.brickHpBoost ?? 0) | 0));
      starBrickBoostBuyBtn.disabled =
        tier2Locked || lv >= STAR_BRICK_BOOST_MAX || starsNow < STAR_BRICK_BOOST_COST;
    }
    if (starHeavyBuyBtn)
      starHeavyBuyBtn.disabled = tier3Locked || getStarUpgradeOwned("heavyBall") || starsNow < 5;
    if (starCollapseBuyBtn)
      starCollapseBuyBtn.disabled = tier3Locked || getStarUpgradeOwned("starCollapse") || starsNow < 5;
    if (starTimeMultBuyBtn)
      starTimeMultBuyBtn.disabled =
        tier3Locked || getStarUpgradeOwned("timeStarMult") || starsNow < STAR_TIME_MULT_COST;
    if (starSpecialCapBuyBtn)
      starSpecialCapBuyBtn.disabled =
        tier3Locked || getStarUpgradeOwned("specialCap") || starsNow < STAR_SPECIAL_CAP_COST;
    if (starMorePointsBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_MORE_POINTS_MAX, (player.starUpgrades?.morePoints ?? 0) | 0));
      starMorePointsBuyBtn.disabled =
        tier3Locked || lv >= STAR_MORE_POINTS_MAX || starsNow < STAR_MORE_POINTS_COST;
    }
    if (starBufferFlowBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_BUFFER_OVERFLOW_MAX, (player.starUpgrades?.bufferOverflow ?? 0) | 0));
      starBufferFlowBuyBtn.disabled =
        tier4Locked || lv >= STAR_BUFFER_OVERFLOW_MAX || starsNow < STAR_BUFFER_OVERFLOW_COST;
    }
    if (starBoardWipeBuyBtn)
      starBoardWipeBuyBtn.disabled =
        tier4Locked || getStarUpgradeOwned("boardWipe") || starsNow < STAR_BOARD_WIPE_COST;
    if (starMoreStarsBuyBtn)
      starMoreStarsBuyBtn.disabled =
        tier5Locked || getStarUpgradeOwned("moreStars") || starsNow < STAR_MORE_STARS_COST;
    if (starMoreBoardWipesBuyBtn)
      starMoreBoardWipesBuyBtn.disabled =
        tier5Locked || getStarUpgradeOwned("moreBoardWipes") || starsNow < STAR_MORE_BOARD_WIPES_COST;
    if (starClearFireSaleBuyBtn)
      starClearFireSaleBuyBtn.disabled =
        tier5Locked || getStarUpgradeOwned("clearFireSale") || starsNow < STAR_CLEAR_FIRE_SALE_COST;
    if (starStarboardMultBuyBtn)
      starStarboardMultBuyBtn.disabled =
        tier5Locked || getStarUpgradeOwned("starboardMultiplier") || starsNow < STAR_STARBOARD_MULT_COST;
    if (starBasicBallsBuyBtn)
      starBasicBallsBuyBtn.disabled =
        tier3Locked || getStarUpgradeOwned("betterBasicBalls") || starsNow < STAR_BASIC_BALLS_COST;
    if (starBallcountBuyBtn)
      starBallcountBuyBtn.disabled = tier4Locked || getStarUpgradeOwned("ballcountPersist") || starsNow < 10;
    if (starBetterFormulaBuyBtn) {
      ensureStarsState();
      const lv = Math.max(0, Math.min(STAR_BETTER_FORMULA_MAX, (player.starUpgrades?.betterFormula ?? 0) | 0));
      starBetterFormulaBuyBtn.disabled = tier4Locked || lv >= STAR_BETTER_FORMULA_MAX || starsNow < STAR_BETTER_FORMULA_COST;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
