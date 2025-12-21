import {
  MAX_SAVED_BALLS,
  createDefaultPlayer,
  getBallDamageValue,
  getBallSpeedMultiplier,
  getPoints,
  normalizePlayer,
} from "../player.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testNormalizeInvalidPoints() {
  const player = normalizePlayer({ points: "nope", clears: "still-nope" });
  assert(getPoints(player).toString() === "0", "invalid points should normalize to 0");
}

function testBallListCap() {
  const balls = Array.from({ length: MAX_SAVED_BALLS + 10 }, (_, i) => ({ id: String(i) }));
  const player = normalizePlayer({ game: { balls } });
  assert(player.game.balls.length === MAX_SAVED_BALLS, "ball list should be capped");
}

function testBestDpsStats() {
  const player = normalizePlayer({
    stats: {
      bestDpsByType: {
        normal: 12.5,
        splash: -3,
        heavy: "nope",
      },
    },
  });
  const best = player.stats?.bestDpsByType ?? {};
  assert(best.normal === 12.5, "best dps should keep valid values");
  assert(best.splash === 0, "best dps should clamp negative values to 0");
  assert(!("heavy" in best), "best dps should ignore non-numeric values");
}

function testResetStats() {
  const player = normalizePlayer({
    clearsStats: { prestiges: 2, lastGain: 4, bestGain: 10, lastPrestigeAt: "nope" },
    starStats: {
      prestiges: 1,
      earnedTotal: 5,
      spentTotal: 2,
      lastPrestigeLevel: 40,
      lastPrestigeAt: "nope",
      bestGain: -7,
    },
  });
  assert(Number.isFinite(player.clearsStats.lastPrestigeAt), "clears last prestige time should be valid");
  assert(Number.isFinite(player.starStats.lastPrestigeAt), "stars last prestige time should be valid");
  assert(player.starStats.bestGain === 0, "star best gain should clamp to 0");
}

function testProgressBestLevel() {
  const player = normalizePlayer({ progress: { level: 5, bestLevel: 2 } });
  assert(player.progress.bestLevel === 5, "best level should be at least current level");
}

function testUpgradeMultipliers() {
  const player = createDefaultPlayer();
  player.ballTypes.normal = {
    damageLevel: 2,
    speedLevel: 3,
    rangeLevel: 0,
    pieceLevel: 0,
    critLevel: 0,
    executionLevel: 0,
  };

  const damageValue = getBallDamageValue(player, "normal", 1);
  const speedMult = getBallSpeedMultiplier(player, "normal");
  assert(damageValue === 3, "damage upgrades should add at least +1 per level");
  assert(speedMult === 1 + 0.24 * 3, "speed multiplier should scale with level");
}

testNormalizeInvalidPoints();
testBallListCap();
testBestDpsStats();
testResetStats();
testProgressBestLevel();
testUpgradeMultipliers();

console.log("normalizePlayer tests passed");
