import {
  CLEARS_SHOP_CONFIG,
  ensureClearsUpgrades,
  ensureGenerationSettings,
  getBrickHpEffectLevel,
  getDensityUpgradeLevel,
} from "../../player.js";
import { clamp } from "./math.js";
import { countAliveBlocks, getNoiseThresholdForMaxFill } from "./level.js";
import { ensureProgress } from "./progress.js";

export function createGridFlow({ getPlayer, grid, world, state }) {
  function updateGridFromPlayer() {
    const player = getPlayer();
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

  function regenerate({ reseed = false } = {}) {
    const player = getPlayer();
    ensureProgress(player);
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
    const brickHpLevel = getBrickHpEffectLevel(player);
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
    const player = getPlayer();
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

  function getMaxDensityLevel() {
    const player = getPlayer();
    ensureGenerationSettings(player);
    const baseThreshold = player.generation.noiseThreshold;
    const step = CLEARS_SHOP_CONFIG.density.thresholdStep;
    const minThreshold = CLEARS_SHOP_CONFIG.density.minNoiseThreshold;
    if (step <= 0) return 0;
    return Math.max(0, Math.floor((baseThreshold - minThreshold) / step));
  }

  return {
    updateGridFromPlayer,
    regenerate,
    tryRestoreGridFromPlayerSave,
    getMaxDensityLevel,
  };
}
