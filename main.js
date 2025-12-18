import { BlockGrid } from "./grid.js";
import { Ball, BALL_TYPES } from "./balls.js";
import { D, formatInt } from "./numbers.js";
import {
  addPoints,
  canAfford,
  clearPlayerSaveFromStorage,
  createDefaultPlayer,
  getBallBuyCost,
  getBallCap,
  ensureBallTypeState,
  ensureCursorState,
  getCursorDamage,
  getCursorUpgradeCost,
  getBallDamageMultiplier,
  getBallDamageUpgradeCost,
  getPoints,
  getBallSpeedMultiplier,
  getBallSpeedUpgradeCost,
  getSplashRangeCap,
  getSplashRangeLevel,
  getSplashRangeUpgradeCost,
  loadPlayerFromStorage,
  normalizePlayer,
  savePlayerToStorage,
  trySpendPoints,
} from "./player.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
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
  const hudLevelEl = document.querySelector("#hud-level");
  const cursorUpgradeBtn = document.querySelector("#cursor-upgrade-btn");
  const statsEl = document.querySelector("#stats");

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

  const desiredCellSize = 56;
  const cols = Math.max(4, Math.round(world.width / desiredCellSize));
  const cellSize = world.width / cols;
  const grid = new BlockGrid({ cellSize, cols, rows: cols });

  const state = {
    uiMessage: null,
    uiMessageUntil: 0,
    initialBlocks: 0,
  };

  let player = loadPlayerFromStorage() ?? createDefaultPlayer();
  player = normalizePlayer(player);
  ensureCursorState(player);

  const game = {
    balls: [],
  };

  const ui = {
    ballCards: new Map(),
  };

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
    const noiseThreshold = 0.65; // 0..1 : higher => more holes (fewer blocks)

    grid.generate({
      pattern: "noise",
      seed,
      noiseScale: 0.28,
      noiseThreshold,
      hpMin: level,
      hpMax: level,
      filledRowsRatio: 1,
      emptyBorder: 0,
    });

    state.initialBlocks = countAliveBlocks(grid);
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
    const speedMult = getBallSpeedMultiplier(player, type.id);

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
    ensureCursorState(player);

    game.balls = (player.game.balls ?? []).map(Ball.fromJSONData).filter(Boolean);

    regenerate();
    if (game.balls.length === 0) {
      spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    }

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
    game.balls = [];
    regenerate({ reseed: true });
    spawnBallAt(world.width * 0.5, world.height * 0.85, "normal", { free: true });
    setMessage("Reset complete");
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
        </div>

        <div class="ball-stats">
          <div>Damage: <span data-role="damage">0</span></div>
          <div>Speed: <span data-role="speed">x1.00</span></div>
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
    });

    for (const typeId of Object.keys(BALL_TYPES)) ensureBallCard(typeId);
  }

  saveBtn?.addEventListener("click", savePlayerNow);
  loadBtn?.addEventListener("click", loadPlayerNow);
  hardResetBtn?.addEventListener("click", hardResetNow);
  cursorUpgradeBtn?.addEventListener("click", () => {
    const cost = getCursorUpgradeCost(player);
    if (!trySpendPoints(player, cost)) return setMessage(`Need ${formatInt(cost)}`);
    ensureCursorState(player).level += 1;
    setMessage(`Cursor damage upgraded`);
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
  regenerate();

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
      regenerate();
      aliveBlocks = countAliveBlocks(grid);
      setMessage(`Level ${player.progress.level}`);
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
    for (const typeId of Object.keys(BALL_TYPES)) {
      const card = ensureBallCard(typeId);
      if (!card) continue;
      const count = countsByType[typeId] ?? 0;

      const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
      const typeState = ensureBallTypeState(player, typeId);
      const dmgMult = getBallDamageMultiplier(player, typeId);
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
      if (dmgEl) dmgEl.textContent = (type.baseDamage * dmgMult).toFixed(2);
      const spdEl = card.querySelector('[data-role="speed"]');
      if (spdEl) spdEl.textContent = `x${spdMult.toFixed(2)}`;
      if (typeId === "splash") {
        const baseR = type.splashRadiusCells ?? 1;
        const radius = baseR + (typeState.rangeLevel ?? 0);
        if (spdEl) spdEl.textContent = `x${spdMult.toFixed(2)} | R${radius}`;
      }

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
    }

    if (cursorUpgradeBtn) {
      const cost = getCursorUpgradeCost(player);
      const damage = getCursorDamage(player);
      cursorUpgradeBtn.textContent = `Cursor DMG ${damage} (+1) (${formatInt(cost)})`;
      cursorUpgradeBtn.disabled = !canAfford(player, cost);
    }

    if (statsEl) {
      const msg = performance.now() < state.uiMessageUntil ? ` | ${state.uiMessage}` : "";
      const level = player.progress?.level ?? 1;
      statsEl.textContent = `Balls: ${game.balls.length} | Blocks: ${aliveBlocks} | Level: ${level} | FPS: ${fpsSmoothed.toFixed(0)}${msg}`;
    }

    if (hudLevelEl) {
      const level = player.progress?.level ?? 1;
      hudLevelEl.textContent = `Level ${level} | Bricks ${aliveBlocks}/${state.initialBlocks}`;
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
