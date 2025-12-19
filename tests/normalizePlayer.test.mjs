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
testUpgradeMultipliers();

console.log("normalizePlayer tests passed");
