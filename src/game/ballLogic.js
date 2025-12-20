import { Ball, BALL_TYPES } from "../../balls.js";
import { formatInt } from "../../numbers.js";
import {
  ensureBallTypeState,
  getBallBuyCost,
  getBallCap,
  getBallDamageValue,
  getBallSpeedMultiplier,
  trySpendPoints,
} from "../../player.js";
import { clamp } from "./math.js";
import { getCritChanceForLevel, getExecuteRatioForLevel, getPieceCountForLevel } from "./upgradeMath.js";
import { getPieceUpgradeCapLevel, getStarUpgradeOwned } from "./stars.js";

export function createBallLogic({ getPlayer, game, world, setMessage }) {
  const notify = typeof setMessage === "function" ? setMessage : null;

  function applyUpgradesToAllBalls() {
    const player = getPlayer();
    const speedMultByType = {};
    const splashRangeByType = {};
    const pieceCountByType = {};
    const critChanceByType = {};
    const executeRatioByType = {};
    const sizeBonusByType = {};

    const pieceUnlocked = getStarUpgradeOwned(player, "pieceCount");
    const pieceCapLevel = getPieceUpgradeCapLevel(player);
    const critUnlocked = getStarUpgradeOwned(player, "criticalHits");
    const execUnlocked = getStarUpgradeOwned(player, "execution");
    const starDamageMult = getStarUpgradeOwned(player, "damageMulti") ? 2 : 1;

    for (const typeId of Object.keys(BALL_TYPES)) {
      const typeState = ensureBallTypeState(player, typeId);
      speedMultByType[typeId] = getBallSpeedMultiplier(player, typeId);
      pieceCountByType[typeId] = pieceUnlocked
        ? getPieceCountForLevel(clamp(typeState.pieceLevel, 0, pieceCapLevel))
        : 1;
      critChanceByType[typeId] = critUnlocked ? getCritChanceForLevel(typeState.critLevel) : 0;
      executeRatioByType[typeId] = execUnlocked ? getExecuteRatioForLevel(typeState.executionLevel) : 0;
      if (typeId === "splash") {
        const baseR = (BALL_TYPES.splash?.splashRadiusCells ?? 1) | 0;
        const bonus = typeState.rangeLevel | 0;
        splashRangeByType[typeId] = baseR + Math.max(0, bonus);
      }
      if (typeId === "heavy") {
        sizeBonusByType[typeId] = Math.max(0, typeState.sizeLevel | 0);
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

      const normalSpeedBonus = typeId === "normal" && getStarUpgradeOwned(player, "betterBasicBalls") ? 5 : 0;
      const desiredSpeed = (ball.data.baseSpeed + normalSpeedBonus) * speedMult;
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
      if (typeId === "heavy") {
        if (!Number.isFinite(ball.data.baseRadius)) ball.data.baseRadius = BALL_TYPES.heavy?.radius ?? ball.radius;
        const desiredRadius = Math.max(1, (ball.data.baseRadius ?? 1) + (sizeBonusByType.heavy ?? 0));
        if (Number.isFinite(desiredRadius) && ball.radius !== desiredRadius) ball.radius = desiredRadius;
      }
    }
  }

  function ensureCursorBall() {
    const player = getPlayer();
    const desiredTypeId = getStarUpgradeOwned(player, "cursorSplash") ? "splash" : "normal";
    const existing = game.balls.find((ball) => ball?.data?.isCursorBall);
    if (existing) {
      if (existing.typeId === desiredTypeId) return existing;
      game.balls = game.balls.filter((ball) => ball !== existing);
    }

    const type = BALL_TYPES[desiredTypeId] ?? BALL_TYPES.normal;
    const typeState = ensureBallTypeState(player, type.id);
    const speedMult = getBallSpeedMultiplier(player, type.id);
    const starDamageMult = getStarUpgradeOwned(player, "damageMulti") ? 2 : 1;
    const baseSpeed = 460 + Math.random() * 80;
    const normalSpeedBonus = type.id === "normal" && getStarUpgradeOwned(player, "betterBasicBalls") ? 5 : 0;
    const speed = (baseSpeed + normalSpeedBonus) * speedMult;
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
    if (type.id === "splash") {
      const baseR = type.splashRadiusCells ?? 1;
      const bonus = Math.max(0, typeState.rangeLevel | 0);
      ball.splashRadiusCells = baseR + bonus;
    }
    game.balls.push(ball);
    return ball;
  }

  function ensureHeavyBall() {
    const player = getPlayer();
    if (!getStarUpgradeOwned(player, "heavyBall")) return null;
    const hasHeavy = game.balls.some((ball) => ball.typeId === "heavy" && !ball.data?.isCursorBall);
    if (hasHeavy) return null;
    spawnBallAt(world.width * 0.5, world.height * 0.85, "heavy", { free: true });
    return game.balls.find((ball) => ball.typeId === "heavy" && !ball.data?.isCursorBall) ?? null;
  }

  function spawnBallAt(x, y, typeId, { free = false } = {}) {
    const player = getPlayer();
    const ownedCount = game.balls.reduce(
      (acc, ball) => acc + (ball.typeId === typeId && !ball.data?.isCursorBall ? 1 : 0),
      0
    );
    const cap = getBallCap(player, typeId);
    if (!free && cap > 0 && ownedCount >= cap) {
      if (notify) notify(`${typeId} cap reached (${cap})`);
      return false;
    }

    const cost = getBallBuyCost(typeId, ownedCount);
    if (!free && !trySpendPoints(player, cost)) {
      if (notify) notify(`Not enough points (need ${formatInt(cost)})`);
      return false;
    }

    const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
    const typeState = ensureBallTypeState(player, type.id);
    const starDamageMult = getStarUpgradeOwned(player, "damageMulti") ? 2 : 1;
    const speedMult = getBallSpeedMultiplier(player, type.id);

    const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
    let baseSpeed = 460 + Math.random() * 80;
    if (type.id === "heavy") baseSpeed *= 0.25;
    const normalSpeedBonus = type.id === "normal" && getStarUpgradeOwned(player, "betterBasicBalls") ? 5 : 0;
    const speed = (baseSpeed + normalSpeedBonus) * speedMult;
    let radius = type.radius;
    let baseRadius = type.radius;
    if (type.id === "heavy") {
      const sizeLevel = Math.max(0, ensureBallTypeState(player, type.id).sizeLevel | 0);
      radius = baseRadius + sizeLevel;
    }
    const ball = Ball.spawn({
      typeId,
      x,
      y,
      speed,
      angleRad: angle,
      damage: getBallDamageValue(player, type.id, type.baseDamage) * starDamageMult,
      radius,
      data: { baseSpeed, baseDamage: type.baseDamage, baseRadius },
    });
    if (type.id === "splash") {
      const baseR = type.splashRadiusCells ?? 1;
      const bonus = Math.max(0, typeState.rangeLevel | 0);
      ball.splashRadiusCells = baseR + bonus;
    }
    game.balls.push(ball);
    return true;
  }

  return {
    applyUpgradesToAllBalls,
    ensureCursorBall,
    ensureHeavyBall,
    spawnBallAt,
  };
}

export function drawManualBallRay(ctx, ball, world, grid) {
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
