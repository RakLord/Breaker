export const BALL_TYPES = {
  normal: {
    id: "normal",
    name: "Normal",
    color: "#e2e8f0",
    radius: 6,
    baseDamage: 1,
    bounceOnBlocks: true,
    onBlockHit({ grid, col, row, ball }) {
      return grid.damageCell(col, row, ball.damage);
    },
  },
  splash: {
    id: "splash",
    name: "Splash",
    color: "#38bdf8",
    radius: 7,
    baseDamage: 0.8,
    bounceOnBlocks: true,
    splashRadiusCells: 1,
    splashFalloff: 0.55,
    onBlockHit({ grid, col, row, ball }) {
      const r = ball.splashRadiusCells ?? 1;
      const destroyedCenter = grid.damageCell(col, row, ball.damage);
      const destroyedNeighbors = grid.damageRadiusCells(
        col,
        row,
        r,
        ball.damage * (ball.splashFalloff ?? 0.55),
        { includeCenter: false }
      );
      return destroyedCenter + destroyedNeighbors;
    },
  },
};

export function createBall({
  typeId = "normal",
  x = 100,
  y = 100,
  speed = 420,
  angleRad = -Math.PI / 3,
  damage = null,
  radius = null,
} = {}) {
  const type = BALL_TYPES[typeId] ?? BALL_TYPES.normal;
  const r = radius ?? type.radius;
  const d = damage ?? type.baseDamage;
  const vx = Math.cos(angleRad) * speed;
  const vy = Math.sin(angleRad) * speed;

  return {
    id: `${typeId}-${Math.random().toString(16).slice(2)}`,
    type,
    x,
    y,
    vx,
    vy,
    radius: r,
    damage: d,
    splashRadiusCells: type.splashRadiusCells,
    splashFalloff: type.splashFalloff,
  };
}
