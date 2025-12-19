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

  const rangeRow =
    type.id === "splash"
      ? `
        <div class="upgrade-row">
          <div class="upgrade-level">Lv <span data-role="rng-lvl">1</span></div>
          <button type="button" data-action="rng-up" data-tooltip-key="ball-range"><span class="btn-label">Range</span> <span class="btn-cost" data-role="rng-cost">(0)</span></button>
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
            <button type="button" data-action="dmg-up" data-tooltip-key="ball-damage"><span class="btn-label">Damage</span> <span class="btn-cost" data-role="dmg-cost">(0)</span></button>
          </div>
          <div class="upgrade-row">
            <div class="upgrade-level">Lv <span data-role="spd-lvl">1</span></div>
            <button type="button" data-action="spd-up" data-tooltip-key="ball-speed"><span class="btn-label">Speed</span> <span class="btn-cost" data-role="spd-cost">(0)</span></button>
          </div>
          ${rangeRow}
          <div class="upgrade-row hidden" data-upgrade="piece">
            <div class="upgrade-level">Lv <span data-role="pc-lvl">1</span></div>
            <button type="button" data-action="pc-up" data-tooltip-key="ball-propagation"><span class="btn-label">Propagation</span> <span class="btn-cost" data-role="pc-cost">(0)</span></button>
          </div>
          <div class="upgrade-row hidden" data-upgrade="crit">
            <div class="upgrade-level">Lv <span data-role="crit-lvl">1</span></div>
            <button type="button" data-action="crit-up" data-tooltip-key="ball-crit"><span class="btn-label">Crit</span> <span class="btn-cost" data-role="crit-cost">(0)</span></button>
          </div>
          <div class="upgrade-row hidden" data-upgrade="exec">
            <div class="upgrade-level">Lv <span data-role="exec-lvl">1</span></div>
            <button type="button" data-action="exec-up" data-tooltip-key="ball-exec"><span class="btn-label">Execute</span> <span class="btn-cost" data-role="exec-cost">(0)</span></button>
          </div>
        </div>

        <div class="ball-stats">
          <div>Damage: <span data-role="damage">0</span></div>
          <div>Speed: <span data-role="speed">x1.00</span></div>
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
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".ball-card");
    const typeId = card?.dataset?.type;
    if (!typeId) return;

    const player = ctx.getPlayer();
    const action = btn.dataset.action;
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
    const count = countsByType[typeId] ?? 0;

    const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
    const typeState = ensureBallTypeState(player, typeId);
    const baseDamage = Number.isFinite(type.baseDamage) ? type.baseDamage : 1;
    const starDamageMult = ctx.getStarUpgradeOwned("damageMulti") ? 2 : 1;
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
    if (dmgEl) dmgEl.textContent = (getBallDamageValue(player, typeId, baseDamage) * starDamageMult).toFixed(2);
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
      const costEl = dmgBtn.querySelector('[data-role="dmg-cost"]');
      if (costEl) costEl.textContent = `(${formatInt(dmgCost)})`;
    }
    const spdBtn = card.querySelector('button[data-action="spd-up"]');
    if (spdBtn) {
      spdBtn.disabled = !canAfford(player, spdCost);
      const lvlEl = card.querySelector('[data-role="spd-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.speedLevel + 1);
      const costEl = spdBtn.querySelector('[data-role="spd-cost"]');
      if (costEl) costEl.textContent = `(${formatInt(spdCost)})`;
    }

    if (typeId === "splash") {
      const capRange = getSplashRangeCap();
      const lvlEl = card.querySelector('[data-role="rng-lvl"]');
      if (lvlEl) lvlEl.textContent = String(typeState.rangeLevel + 1);

      const cost = getSplashRangeUpgradeCost(player);
      const costEl = card.querySelector('[data-role="rng-cost"]');
      if (costEl) costEl.textContent = `(${formatInt(cost)})`;

      const btn = card.querySelector('button[data-action="rng-up"]');
      if (btn) btn.disabled = typeState.rangeLevel >= capRange || !canAfford(player, cost);
    }

    if (pieceUnlocked) {
      const capLevel = ctx.getPieceUpgradeCapLevel();
      const atCap = typeState.pieceLevel >= capLevel;
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
