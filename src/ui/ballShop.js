import { BALL_TYPES } from "../../balls.js";
import { D, formatInt } from "../../numbers.js";
import {
  canAfford,
  ensureBallTypeState,
  getBallBuyCost,
  getBallCap,
  getBallCritUpgradeCost,
  getBallDamageValue,
  getBallDamageUpgradeCost,
  getBallExecutionUpgradeCost,
  getBallPieceCountUpgradeCost,
  getBallSpeedMultiplier,
  getBallSpeedUpgradeCost,
  getBallSizeUpgradeCost,
  getPoints,
  getSplashRangeCap,
  getSplashRangeUpgradeCost,
  trySpendPoints,
} from "../../player.js";
import { clamp } from "../game/math.js";
import { initTooltips } from "../tooltips.js";

export function ensureBallCard(ctx, typeId) {
  if (!ctx.dom.ballListEl) return null;
  if (ctx.ui.ballCards.has(typeId)) return ctx.ui.ballCards.get(typeId);

  const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
  ensureBallTypeState(ctx.getPlayer(), type.id);

  const card = document.createElement("div");
  card.className = "ball-card";
  card.dataset.type = type.id;
  if (typeof ctx.getBallCardMinimized === "function" && ctx.getBallCardMinimized(type.id)) {
    card.classList.add("card-minimized");
  }
  if (type.id === "heavy" && !ctx.getStarUpgradeOwned("heavyBall")) {
    card.classList.add("hidden");
  }

  const rangeRow =
    type.id === "splash"
      ? `
        <button type="button" data-action="rng-up" data-tooltip-key="ball-range" class="ball-upgrade-row">
          <div class="ball-upgrade-main">
            <div class="ball-upgrade-title">Range</div>
            <div class="ball-upgrade-cost">Cost: <span data-role="rng-cost">0</span></div>
          </div>
          <div class="ball-upgrade-meta">
            <div class="ball-upgrade-level">LV <span data-role="rng-lvl">0</span><span class="ball-upgrade-max" data-role="rng-max"></span></div>
            <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="rng-progress"></span></div>
          </div>
        </button>
      `
      : "";
  const sizeRow =
    type.id === "heavy"
      ? `
        <button type="button" data-action="size-up" data-tooltip-key="ball-size" class="ball-upgrade-row">
          <div class="ball-upgrade-main">
            <div class="ball-upgrade-title">Size</div>
            <div class="ball-upgrade-cost">Cost: <span data-role="size-cost">0</span></div>
          </div>
          <div class="ball-upgrade-meta">
            <div class="ball-upgrade-level">LV <span data-role="size-lvl">0</span><span class="ball-upgrade-max" data-role="size-max"></span></div>
            <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="size-progress"></span></div>
          </div>
        </button>
      `
      : "";

  card.innerHTML = `
      <div class="ball-card-header">
        <div class="ball-name">${type.name}</div>
        <button type="button" class="ball-card-toggle" data-action="toggle" aria-label="Toggle card"></button>
      </div>

      <div class="ball-card-body">
        <div class="ball-upgrades">
          <button type="button" data-action="buy" class="ball-upgrade-row">
            <div class="ball-upgrade-main">
              <div class="ball-upgrade-title">Buy</div>
              <div class="ball-upgrade-cost">Cost: <span data-role="buy-cost">0</span></div>
            </div>
            <div class="ball-upgrade-meta">
              <div class="ball-upgrade-level"><span data-role="count">0</span><span data-role="cap-sep">/</span><span data-role="cap">0</span></div>
              <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="buy-progress"></span></div>
            </div>
          </button>
          <button type="button" data-action="dmg-up" data-tooltip-key="ball-damage" class="ball-upgrade-row">
            <div class="ball-upgrade-main">
              <div class="ball-upgrade-title">Damage</div>
              <div class="ball-upgrade-cost">Cost: <span data-role="dmg-cost">0</span></div>
            </div>
            <div class="ball-upgrade-meta">
              <div class="ball-upgrade-level">LV <span data-role="dmg-lvl">0</span><span class="ball-upgrade-max" data-role="dmg-max"></span></div>
              <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="dmg-progress"></span></div>
            </div>
          </button>
          <button type="button" data-action="spd-up" data-tooltip-key="ball-speed" class="ball-upgrade-row">
            <div class="ball-upgrade-main">
              <div class="ball-upgrade-title">Speed</div>
              <div class="ball-upgrade-cost">Cost: <span data-role="spd-cost">0</span></div>
            </div>
            <div class="ball-upgrade-meta">
              <div class="ball-upgrade-level">LV <span data-role="spd-lvl">0</span><span class="ball-upgrade-max" data-role="spd-max"></span></div>
              <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="spd-progress"></span></div>
            </div>
          </button>
          ${sizeRow}
          ${rangeRow}
          <div class="ball-upgrade-slot hidden" data-upgrade="piece">
            <button type="button" data-action="pc-up" data-tooltip-key="ball-propagation" class="ball-upgrade-row">
              <div class="ball-upgrade-main">
                <div class="ball-upgrade-title">Propagation</div>
                <div class="ball-upgrade-cost">Cost: <span data-role="pc-cost">0</span></div>
              </div>
              <div class="ball-upgrade-meta">
                <div class="ball-upgrade-level">LV <span data-role="pc-lvl">0</span><span class="ball-upgrade-max" data-role="pc-max"></span></div>
                <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="pc-progress"></span></div>
              </div>
            </button>
          </div>
          <div class="ball-upgrade-slot hidden" data-upgrade="crit">
            <button type="button" data-action="crit-up" data-tooltip-key="ball-crit" class="ball-upgrade-row">
              <div class="ball-upgrade-main">
                <div class="ball-upgrade-title">Crit</div>
                <div class="ball-upgrade-cost">Cost: <span data-role="crit-cost">0</span></div>
              </div>
              <div class="ball-upgrade-meta">
                <div class="ball-upgrade-level">LV <span data-role="crit-lvl">0</span><span class="ball-upgrade-max" data-role="crit-max"></span></div>
                <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="crit-progress"></span></div>
              </div>
            </button>
          </div>
          <div class="ball-upgrade-slot hidden" data-upgrade="exec">
            <button type="button" data-action="exec-up" data-tooltip-key="ball-exec" class="ball-upgrade-row">
              <div class="ball-upgrade-main">
                <div class="ball-upgrade-title">Execute</div>
                <div class="ball-upgrade-cost">Cost: <span data-role="exec-cost">0</span></div>
              </div>
              <div class="ball-upgrade-meta">
                <div class="ball-upgrade-level">LV <span data-role="exec-lvl">0</span><span class="ball-upgrade-max" data-role="exec-max"></span></div>
                <div class="ball-upgrade-bar"><span class="ball-upgrade-fill" data-role="exec-progress"></span></div>
              </div>
            </button>
          </div>
        </div>

        <div class="ball-stats">
          <div>Damage: <span data-role="damage">0</span></div>
          <div>Speed: <span data-role="speed">x1.00</span></div>
          <div>DPS: <span data-role="dps">0.00</span></div>
          <div class="hidden" data-role="pieces-row">Propagation: <span data-role="pieces">1</span></div>
          <div class="hidden" data-role="crit-row">Crit: <span data-role="crit">0%</span></div>
          <div class="hidden" data-role="exec-row">Execute: <span data-role="exec">0%</span></div>
        </div>
      </div>
    `;

  ctx.dom.ballListEl.appendChild(card);
  ctx.ui.ballCards.set(type.id, card);
  initTooltips(card);
  return card;
}

export function initBallShopUI(ctx) {
  if (!ctx.dom.ballListEl) return;
  ctx.dom.ballListEl.addEventListener("click", (e) => {
    const card = e.target.closest(".ball-card");
    if (!card) return;
    const typeId = card?.dataset?.type;
    if (!typeId) return;

    const btn = e.target.closest("button[data-action]");
    if (!btn) {
      if (card.classList.contains("card-minimized") && e.target.closest(".ball-card-header")) {
        card.classList.remove("card-minimized");
        ctx.setBallCardMinimized?.(typeId, false);
      }
      return;
    }

    const player = ctx.getPlayer();
    const action = btn.dataset.action;
    if (action === "toggle") {
      const next = !card.classList.contains("card-minimized");
      card.classList.toggle("card-minimized", next);
      ctx.setBallCardMinimized?.(typeId, next);
      return;
    }
    if (action === "buy") {
      ctx.spawnBallAt(ctx.world.width * 0.5, ctx.world.height * 0.85, typeId);
      return;
    }
    if (action === "dmg-up") {
      const cost = getBallDamageUpgradeCost(player, typeId);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      ensureBallTypeState(player, typeId).damageLevel += 1;
      ctx.setMessage(`${typeId} damage upgraded`);
      return;
    }
    if (action === "spd-up") {
      const cost = getBallSpeedUpgradeCost(player, typeId);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      ensureBallTypeState(player, typeId).speedLevel += 1;
      ctx.setMessage(`${typeId} speed upgraded`);
      return;
    }
    if (action === "size-up" && typeId === "heavy") {
      const state = ensureBallTypeState(player, typeId);
      const cap = 10;
      if (state.sizeLevel >= cap) return ctx.setMessage(`Heavy size max (Lv ${cap})`);
      const cost = getBallSizeUpgradeCost(player, typeId);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      state.sizeLevel += 1;
      ctx.applyUpgradesToAllBalls?.();
      ctx.setMessage("Heavy size upgraded");
      return;
    }
    if (action === "rng-up" && typeId === "splash") {
      const cap = getSplashRangeCap();
      const state = ensureBallTypeState(player, "splash");
      if (state.rangeLevel >= cap) return ctx.setMessage(`Splash range max (Lv ${cap})`);

      const cost = getSplashRangeUpgradeCost(player);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      state.rangeLevel += 1;
      ctx.setMessage("Splash range upgraded");
    }
    if (action === "pc-up") {
      if (!ctx.getStarUpgradeOwned("pieceCount")) return ctx.setMessage("Unlock Propagation in Star Board");
      const cap = ctx.getPieceUpgradeCapLevel();
      const state = ensureBallTypeState(player, typeId);
      if (state.pieceLevel >= cap) return ctx.setMessage(`Propagation cap reached (Lv ${cap})`);
      const cost = getBallPieceCountUpgradeCost(player, typeId);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      state.pieceLevel += 1;
      ctx.setMessage(`${typeId} propagation upgraded`);
      return;
    }
    if (action === "crit-up") {
      if (!ctx.getStarUpgradeOwned("criticalHits")) return ctx.setMessage("Unlock Critical Hits in Star Board");
      const cost = getBallCritUpgradeCost(player, typeId);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      ensureBallTypeState(player, typeId).critLevel += 1;
      ctx.setMessage(`${typeId} crit upgraded`);
      return;
    }
    if (action === "exec-up") {
      if (!ctx.getStarUpgradeOwned("execution")) return ctx.setMessage("Unlock Execution in Star Board");
      const cost = getBallExecutionUpgradeCost(player, typeId);
      if (!trySpendPoints(player, cost)) return ctx.setMessage(`Need ${formatInt(cost)}`);
      ensureBallTypeState(player, typeId).executionLevel += 1;
      ctx.setMessage(`${typeId} execution upgraded`);
    }
  });

  ctx.dom.ballListEl.addEventListener("pointerover", (e) => {
    if (!ctx.isBallContextEnabled()) return;
    const card = e.target.closest(".ball-card");
    if (!card) return;
    const typeId = card.dataset.type;
    if (typeId) ctx.setBallContextType(typeId);
  });
  ctx.dom.ballListEl.addEventListener("pointerout", (e) => {
    if (!ctx.isBallContextEnabled()) return;
    const card = e.target.closest(".ball-card");
    if (!card) return;
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    ctx.setBallContextType(null);
  });
  ctx.dom.ballListEl.addEventListener("pointerleave", () => {
    if (!ctx.isBallContextEnabled()) return;
    ctx.setBallContextType(null);
  });

  for (const typeId of Object.keys(BALL_TYPES)) ensureBallCard(ctx, typeId);
}

export function updateBallShopCards(ctx) {
  if (!ctx.dom.ballListEl) return;
  const player = ctx.getPlayer();
  const pointsNow = getPoints(player);
  const revealThreshold = D(0.75);
  const shouldReveal = (cost) => pointsNow.gte(cost.mul(revealThreshold));
  const getAffordRatio = (cost) => {
    if (!cost || typeof cost.lte !== "function") return 0;
    if (cost.lte(0)) return 1;
    if (pointsNow.gte(cost)) return 1;
    const raw = pointsNow.div(cost).toNumber();
    return Number.isFinite(raw) ? clamp(raw, 0, 1) : 0;
  };
  const setProgress = (card, role, ratio) => {
    const el = card.querySelector(`[data-role="${role}"]`);
    if (!el) return;
    const clamped = clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1);
    el.style.width = `${(clamped * 100).toFixed(1)}%`;
  };

  const countsByType = {};
  for (const ball of ctx.game.balls) {
    if (ball.data?.isCursorBall) continue;
    countsByType[ball.typeId] = (countsByType[ball.typeId] ?? 0) + 1;
  }
  const pieceUnlocked = ctx.getStarUpgradeOwned("pieceCount");
  const critUnlocked = ctx.getStarUpgradeOwned("criticalHits");
  const execUnlocked = ctx.getStarUpgradeOwned("execution");
  for (const typeId of Object.keys(BALL_TYPES)) {
    const card = ensureBallCard(ctx, typeId);
    if (!card) continue;
    if (typeof ctx.getBallCardMinimized === "function") {
      card.classList.toggle("card-minimized", ctx.getBallCardMinimized(typeId));
    }
    if (typeId === "heavy" && !ctx.getStarUpgradeOwned("heavyBall")) {
      card.classList.add("hidden");
      continue;
    }
    card.classList.remove("hidden");
    const count = countsByType[typeId] ?? 0;

    const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
    const typeState = ensureBallTypeState(player, typeId);
    const baseDamage = Number.isFinite(type.baseDamage) ? type.baseDamage : 1;
    const starDamageMult = ctx.getStarUpgradeOwned("damageMulti") ? 2 : 1;
    const spdMult = getBallSpeedMultiplier(player, typeId);
    const dmgCost = getBallDamageUpgradeCost(player, typeId);
    const spdCost = getBallSpeedUpgradeCost(player, typeId);
    const sizeCost = typeId === "heavy" ? getBallSizeUpgradeCost(player, typeId) : null;
    const cap = getBallCap(player, typeId);
    const buyCost = getBallBuyCost(typeId, count);

    const unlocked = count > 0 || (typeId === "heavy" && ctx.getStarUpgradeOwned("heavyBall"));
    card.classList.toggle("card-collapsed", !unlocked && !shouldReveal(buyCost));

    const atCap = cap > 0 && count >= cap;
    const countEl = card.querySelector('[data-role="count"]');
    if (countEl) countEl.textContent = atCap ? "MAX" : String(count);
    const capEl = card.querySelector('[data-role="cap"]');
    if (capEl) capEl.textContent = atCap ? "" : String(cap);
    const capSepEl = card.querySelector('[data-role="cap-sep"]');
    if (capSepEl) capSepEl.classList.toggle("hidden", atCap);
    const dmgEl = card.querySelector('[data-role="damage"]');
    if (dmgEl) dmgEl.textContent = (getBallDamageValue(player, typeId, baseDamage) * starDamageMult).toFixed(2);
    const spdEl = card.querySelector('[data-role="speed"]');
    if (spdEl) spdEl.textContent = `x${spdMult.toFixed(2)}`;
    const dpsEl = card.querySelector('[data-role="dps"]');
    if (dpsEl) {
      const dpsRaw = typeof ctx.getBallDps === "function" ? ctx.getBallDps(typeId) : 0;
      const dpsValue = Number.isFinite(dpsRaw) ? dpsRaw : 0;
      dpsEl.textContent = dpsValue.toFixed(2);
    }
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
      buyBtn.disabled = atCap || !canAfford(player, buyCost);
      const costEl = buyBtn.querySelector('[data-role="buy-cost"]');
      if (costEl) costEl.textContent = atCap ? "MAX" : formatInt(buyCost);
      setProgress(card, "buy-progress", atCap ? 1 : getAffordRatio(buyCost));
    }
    const dmgBtn = card.querySelector('button[data-action="dmg-up"]');
    if (dmgBtn) {
      dmgBtn.disabled = !canAfford(player, dmgCost);
      const lvlEl = card.querySelector('[data-role="dmg-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.damageLevel);
      const maxEl = card.querySelector('[data-role="dmg-max"]');
      if (maxEl) maxEl.textContent = "";
      const costEl = dmgBtn.querySelector('[data-role="dmg-cost"]');
      if (costEl) costEl.textContent = formatInt(dmgCost);
      setProgress(card, "dmg-progress", getAffordRatio(dmgCost));
    }
    const spdBtn = card.querySelector('button[data-action="spd-up"]');
    if (spdBtn) {
      spdBtn.disabled = !canAfford(player, spdCost);
      const lvlEl = card.querySelector('[data-role="spd-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.speedLevel);
      const maxEl = card.querySelector('[data-role="spd-max"]');
      if (maxEl) maxEl.textContent = "";
      const costEl = spdBtn.querySelector('[data-role="spd-cost"]');
      if (costEl) costEl.textContent = formatInt(spdCost);
      setProgress(card, "spd-progress", getAffordRatio(spdCost));
    }
    if (typeId === "heavy") {
      const sizeBtn = card.querySelector('button[data-action="size-up"]');
      if (sizeBtn) {
        const cap = 10;
        const atCap = typeState.sizeLevel >= cap;
        sizeBtn.disabled = atCap || !canAfford(player, sizeCost);
        const lvlEl = card.querySelector('[data-role="size-lvl"]');
        if (lvlEl) lvlEl.textContent = String(typeState.sizeLevel);
        const maxEl = card.querySelector('[data-role="size-max"]');
        if (maxEl) maxEl.textContent = `/${cap}`;
        const costEl = sizeBtn.querySelector('[data-role="size-cost"]');
        if (costEl) costEl.textContent = atCap ? "MAX" : formatInt(sizeCost);
        setProgress(card, "size-progress", atCap ? 1 : getAffordRatio(sizeCost));
      }
    }

    if (typeId === "splash") {
      const capRange = getSplashRangeCap();
      const lvlEl = card.querySelector('[data-role="rng-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.rangeLevel);
      const maxEl = card.querySelector('[data-role="rng-max"]');
      if (maxEl) maxEl.textContent = `/${capRange}`;

      const cost = getSplashRangeUpgradeCost(player);
      const costEl = card.querySelector('[data-role="rng-cost"]');
      if (costEl) costEl.textContent = typeState.rangeLevel >= capRange ? "MAX" : formatInt(cost);
      setProgress(card, "rng-progress", typeState.rangeLevel >= capRange ? 1 : getAffordRatio(cost));

      const btn = card.querySelector('button[data-action="rng-up"]');
      if (btn) btn.disabled = typeState.rangeLevel >= capRange || !canAfford(player, cost);
    }

    if (pieceUnlocked) {
      const capLevel = ctx.getPieceUpgradeCapLevel();
      const atCap = typeState.pieceLevel >= capLevel;
      const cost = getBallPieceCountUpgradeCost(player, typeId);
      const lvlEl = card.querySelector('[data-role="pc-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.pieceLevel);
      const maxEl = card.querySelector('[data-role="pc-max"]');
      if (maxEl) maxEl.textContent = `/${capLevel}`;
      const costEl = card.querySelector('[data-role="pc-cost"]');
      if (costEl) costEl.textContent = atCap ? "MAX" : formatInt(cost);
      setProgress(card, "pc-progress", atCap ? 1 : getAffordRatio(cost));
      const btn = card.querySelector('button[data-action="pc-up"]');
      if (btn) btn.disabled = atCap || !canAfford(player, cost);
    }

    if (critUnlocked) {
      const cost = getBallCritUpgradeCost(player, typeId);
      const lvlEl = card.querySelector('[data-role="crit-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.critLevel);
      const maxEl = card.querySelector('[data-role="crit-max"]');
      if (maxEl) maxEl.textContent = "";
      const costEl = card.querySelector('[data-role="crit-cost"]');
      if (costEl) costEl.textContent = formatInt(cost);
      setProgress(card, "crit-progress", getAffordRatio(cost));
      const btn = card.querySelector('button[data-action="crit-up"]');
      if (btn) btn.disabled = !canAfford(player, cost);
    }

    if (execUnlocked) {
      const cost = getBallExecutionUpgradeCost(player, typeId);
      const lvlEl = card.querySelector('[data-role="exec-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.executionLevel);
      const maxEl = card.querySelector('[data-role="exec-max"]');
      if (maxEl) maxEl.textContent = "";
      const costEl = card.querySelector('[data-role="exec-cost"]');
      if (costEl) costEl.textContent = formatInt(cost);
      setProgress(card, "exec-progress", getAffordRatio(cost));
      const btn = card.querySelector('button[data-action="exec-up"]');
      if (btn) btn.disabled = !canAfford(player, cost);
    }

    const piecesRow = card.querySelector('[data-role="pieces-row"]');
    if (piecesRow) piecesRow.classList.toggle("hidden", !pieceUnlocked);
    const piecesEl = card.querySelector('[data-role="pieces"]');
    if (piecesEl && pieceUnlocked) {
      const level = clamp(typeState.pieceLevel, 0, ctx.getPieceUpgradeCapLevel());
      piecesEl.textContent = String(ctx.getPieceCountForLevel(level));
    }

    const critRowEl = card.querySelector('[data-role="crit-row"]');
    if (critRowEl) critRowEl.classList.toggle("hidden", !critUnlocked);
    const critEl = card.querySelector('[data-role="crit"]');
    if (critEl && critUnlocked) {
      critEl.textContent = `${Math.round(ctx.getCritChanceForLevel(typeState.critLevel) * 100)}%`;
    }

    const execRowEl = card.querySelector('[data-role="exec-row"]');
    if (execRowEl) execRowEl.classList.toggle("hidden", !execUnlocked);
    const execEl = card.querySelector('[data-role="exec"]');
    if (execEl && execUnlocked) {
      execEl.textContent = `${Math.round(ctx.getExecuteRatioForLevel(typeState.executionLevel) * 100)}%`;
    }
  }
}
