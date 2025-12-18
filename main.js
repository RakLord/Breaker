import { BlockGrid } from "./grid.js";
import { Ball, BALL_TYPES } from "./balls.js";
import { parseSeedToUint32 } from "./rng.js";
import { D, format } from "./numbers.js";
import {
  addPoints,
  canAfford,
  createDefaultPlayer,
  getBallSpawnCost,
  getDamageMultiplier,
  getDamageUpgradeCost,
  getPoints,
  getSpeedMultiplier,
  getSpeedUpgradeCost,
  loadPlayerFromStorage,
  normalizePlayer,
  savePlayerToStorage,
  trySpendPoints,
} from "./player.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function resizeCanvasToContainer(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

function main() {
  const canvas = document.querySelector("#game-canvas");
  const patternSelect = document.querySelector("#pattern-select");
  const seedInput = document.querySelector("#seed-input");
  const regenBtn = document.querySelector("#regen-btn");
  const ballTypeSelect = document.querySelector("#balltype-select");
  const addBallBtn = document.querySelector("#addball-btn");
  const pointsEl = document.querySelector("#points");
  const upgradeDamageBtn = document.querySelector("#upgrade-damage-btn");
  const upgradeSpeedBtn = document.querySelector("#upgrade-speed-btn");
  const saveBtn = document.querySelector("#save-btn");
  const loadBtn = document.querySelector("#load-btn");
  const statsEl = document.querySelector("#stats");

  if (!canvas) throw new Error("Missing #game-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const world = { width: 800, height: 450 };
  const grid = new BlockGrid({ cellSize: 26, cols: 10, rows: 10 });

  const state = {
    seed: parseSeedToUint32(seedInput?.value),
    pattern: patternSelect?.value ?? "noise",
    uiMessage: null,
    uiMessageUntil: 0,
  };

  let player = loadPlayerFromStorage() ?? createDefaultPlayer();
  player = normalizePlayer(player);

  const game = {
    balls: [],
  };

  function setMessage(msg, seconds = 1.6) {
    state.uiMessage = msg;
    state.uiMessageUntil = performance.now() + seconds * 1000;
  }

  function regenerate({ reseed = false } = {}) {
    state.pattern = patternSelect?.value ?? "noise";
    state.seed = reseed ? parseSeedToUint32(seedInput?.value) : state.seed;

    player.map.pattern = state.pattern;
    player.map.seed = state.seed;

    grid.generate({
      pattern: state.pattern,
      seed: state.seed,
      noiseScale: 0.22,
      fill: 0.7,
      hpMin: 3,
      hpMax: 18,
      filledRowsRatio: 0.56,
      emptyBorder: 1,
    });
  }

  function spawnBallAt(x, y, typeId, { free = false } = {}) {
    const cost = getBallSpawnCost();
    if (!free && !trySpendPoints(player, cost)) {
      setMessage(`Not enough points (need ${format(cost)})`);
      return false;
    }

    const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
    const damageMult = getDamageMultiplier(player);
    const speedMult = getSpeedMultiplier(player);

    const angle = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
    const speed = (460 + Math.random() * 80) * speedMult;
    const ball = Ball.spawn({
      typeId,
      x,
      y,
      speed,
      angleRad: angle,
      damage: type.baseDamage * damageMult,
    });
    game.balls.push(ball);
    return true;
  }

  function savePlayerNow({ silent = false } = {}) {
    player.map.pattern = state.pattern;
    player.map.seed = state.seed;
    player.game.balls = game.balls.map((b) => b.toJSONData());
    player = savePlayerToStorage(player);
    if (!silent) setMessage("Saved");
  }

  function loadPlayerNow() {
    const loaded = loadPlayerFromStorage();
    if (!loaded) {
      setMessage("No save found");
      return false;
    }

    player = normalizePlayer(loaded);

    state.pattern = player.map.pattern ?? "noise";
    state.seed = player.map.seed ?? parseSeedToUint32(seedInput?.value);

    if (patternSelect) patternSelect.value = state.pattern;
    if (seedInput) seedInput.value = player.map.seed === null ? "" : String(player.map.seed);

    game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);

    regenerate();
    if (game.balls.length === 0) {
      spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    }

    setMessage("Loaded");
    return true;
  }

  regenBtn?.addEventListener("click", () => regenerate({ reseed: true }));
  addBallBtn?.addEventListener("click", () => {
    const typeId = ballTypeSelect?.value ?? "normal";
    spawnBallAt(world.width * 0.5, world.height * 0.85, typeId);
  });
  upgradeDamageBtn?.addEventListener("click", () => {
    const cost = getDamageUpgradeCost(player);
    if (!trySpendPoints(player, cost)) return setMessage(`Need ${format(cost)}`);
    player.upgrades.damageLevel += 1;
    setMessage(`Damage upgraded to L${player.upgrades.damageLevel}`);
  });
  upgradeSpeedBtn?.addEventListener("click", () => {
    const cost = getSpeedUpgradeCost(player);
    if (!trySpendPoints(player, cost)) return setMessage(`Need ${format(cost)}`);
    player.upgrades.speedLevel += 1;
    setMessage(`Speed upgraded to L${player.upgrades.speedLevel}`);
  });

  saveBtn?.addEventListener("click", savePlayerNow);
  loadBtn?.addEventListener("click", loadPlayerNow);
  window.addEventListener("beforeunload", () => savePlayerNow({ silent: true }));

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const typeId = ballTypeSelect?.value ?? "normal";
    spawnBallAt(x, y, typeId);
  });

  const resizeObserver = new ResizeObserver(() => {
    const { width, height } = resizeCanvasToContainer(canvas, ctx);
    world.width = width;
    world.height = height;
    const cols = Math.max(6, Math.floor(width / grid.cellSize));
    const rows = Math.max(6, Math.floor(height / grid.cellSize));
    grid.resize(cols, rows);
    regenerate();
  });
  resizeObserver.observe(canvas);

  {
    const { width, height } = resizeCanvasToContainer(canvas, ctx);
    world.width = width;
    world.height = height;
  }

  if (patternSelect && player.map.pattern) patternSelect.value = player.map.pattern;
  if (seedInput && player.map.seed !== null && player.map.seed !== undefined) seedInput.value = String(player.map.seed);
  state.pattern = player.map.pattern ?? state.pattern;
  state.seed = player.map.seed ?? state.seed;

  regenerate({ reseed: player.map.seed === null || player.map.seed === undefined });

  game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);
  if (game.balls.length === 0) {
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
  }

  setInterval(() => {
    savePlayerNow({ silent: true });
  }, 15000);

  let lastT = performance.now();
  let fpsSmoothed = 60;

  function frame(t) {
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;

    fpsSmoothed = fpsSmoothed * 0.93 + (1 / Math.max(1e-6, dt)) * 0.07;

    let destroyed = 0;
    for (const ball of game.balls) destroyed += ball.step(dt, world, grid);
    if (destroyed > 0) addPoints(player, D(destroyed));

    ctx.clearRect(0, 0, world.width, world.height);
    grid.draw(ctx);
    for (const ball of game.balls) ball.draw(ctx);

    const spawnCost = getBallSpawnCost();
    const dmgCost = getDamageUpgradeCost(player);
    const spdCost = getSpeedUpgradeCost(player);

    if (addBallBtn) {
      const afford = canAfford(player, spawnCost);
      addBallBtn.textContent = `Add Ball (-${format(spawnCost)})`;
      addBallBtn.disabled = !afford;
    }

    if (pointsEl) pointsEl.textContent = `Points: ${format(getPoints(player))}`;
    if (upgradeDamageBtn) {
      upgradeDamageBtn.textContent = `Damage L${player.upgrades.damageLevel} (-${format(dmgCost)})`;
      upgradeDamageBtn.disabled = !canAfford(player, dmgCost);
    }
    if (upgradeSpeedBtn) {
      upgradeSpeedBtn.textContent = `Speed L${player.upgrades.speedLevel} (-${format(spdCost)})`;
      upgradeSpeedBtn.disabled = !canAfford(player, spdCost);
    }

    if (statsEl) {
      const msg = performance.now() < state.uiMessageUntil ? ` | ${state.uiMessage}` : "";
      statsEl.textContent = `Balls: ${game.balls.length} | Blocks: ${countAliveBlocks(
        grid
      )} | DPS: x${getDamageMultiplier(player).toFixed(2)} | Speed: x${getSpeedMultiplier(
        player
      ).toFixed(2)} | FPS: ${fpsSmoothed.toFixed(0)}${msg}`;
    }

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
