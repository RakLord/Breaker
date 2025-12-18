export const BALL_TYPES = {
  normal: {
    id: "normal",
    name: "Normal",
    color: "#e2e8f0",
    radius: 6,
    baseDamage: 1,
    bounceOnBlocks: true,
    onBlockHit({ grid, col, row, ball }) {
      return grid.applyDamageCell(col, row, ball.damage).damageDealt;
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
      const center = grid.applyDamageCell(col, row, ball.damage);
      const neighbors = grid.applyDamageRadiusCells(
        col,
        row,
        r,
        ball.damage * (ball.splashFalloff ?? 0.55),
        { includeCenter: false }
      );
      return center.damageDealt + neighbors.damageDealt;
    },
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    color: "#fbbf24",
    radius: 6,
    baseDamage: 1.25,
    bounceOnBlocks: true,
    onBlockHit({ grid, col, row, ball }) {
      return grid.applyDamageCell(col, row, ball.damage).damageDealt;
    },
  },
  sweeper: {
    id: "sweeper",
    name: "Sweeper",
    color: "#a78bfa",
    radius: 7,
    baseDamage: 1,
    bounceOnBlocks: true,
    onBlockHit({ grid, col, row, ball }) {
      const hitRes = grid.applyDamageCell(col, row, ball.damage);
      if (hitRes.destroyed <= 0) return hitRes.damageDealt;
      const rowRes = grid.applyDamageRow(row, ball.damage, { excludeCol: col });
      return hitRes.damageDealt + rowRes.damageDealt;
    },
  },
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function reflectVelocity(ball, nx, ny) {
  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx -= 2 * dot * nx;
  ball.vy -= 2 * dot * ny;
}

export class Ball {
  constructor({
    id = null,
    typeId = "normal",
    x = 100,
    y = 100,
    vx = 0,
    vy = -420,
    radius = null,
    damage = null,
    data = null,
  } = {}) {
    this.id = id ?? `${typeId}-${Math.random().toString(16).slice(2)}`;
    this.typeId = typeId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    const type = BALL_TYPES[this.typeId] ?? BALL_TYPES.normal;
    this.radius = radius ?? type.radius;
    this.damage = damage ?? type.baseDamage;

    this.data = data && typeof data === "object" ? data : {};

    this.splashRadiusCells = type.splashRadiusCells;
    this.splashFalloff = type.splashFalloff;
  }

  get type() {
    return BALL_TYPES[this.typeId] ?? BALL_TYPES.normal;
  }

  static spawn({
    typeId = "normal",
    x = 100,
    y = 100,
    speed = 420,
    angleRad = -Math.PI / 3,
    damage = null,
    radius = null,
    data = null,
  } = {}) {
    const vx = Math.cos(angleRad) * speed;
    const vy = Math.sin(angleRad) * speed;
    return new Ball({ typeId, x, y, vx, vy, damage, radius, data });
  }

  step(dt, world, grid) {
    const speed = Math.hypot(this.vx, this.vy);
    const maxStep = Math.max(2, this.radius * 0.75);
    const steps = clamp(Math.ceil((speed * dt) / maxStep), 1, 12);
    const stepDt = dt / steps;

    let destroyed = 0;

    for (let i = 0; i < steps; i++) {
      this.x += this.vx * stepDt;
      this.y += this.vy * stepDt;

      let bouncedWall = false;

      if (this.x - this.radius < 0) {
        this.x = this.radius;
        this.vx = Math.abs(this.vx);
        bouncedWall = true;
      } else if (this.x + this.radius > world.width) {
        this.x = world.width - this.radius;
        this.vx = -Math.abs(this.vx);
        bouncedWall = true;
      }

      if (this.y - this.radius < 0) {
        this.y = this.radius;
        this.vy = Math.abs(this.vy);
        bouncedWall = true;
      } else if (this.y + this.radius > world.height) {
        this.y = world.height - this.radius;
        this.vy = -Math.abs(this.vy);
        bouncedWall = true;
      }

      if (bouncedWall && this.typeId === "sniper") {
        const target = grid.getFarthestAliveBlock(this.x, this.y);
        if (target) {
          const speed = Math.hypot(this.vx, this.vy) || 1;
          const dx = target.x - this.x;
          const dy = target.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          this.vx = (dx / len) * speed;
          this.vy = (dy / len) * speed;
        }
      }

      const hit = grid.findCircleCollision(this.x, this.y, this.radius);
      if (hit) {
        destroyed += this.type.onBlockHit({ grid, col: hit.col, row: hit.row, ball: this });

        if (this.type.bounceOnBlocks) {
          this.x += hit.nx * (hit.penetration + 0.01);
          this.y += hit.ny * (hit.penetration + 0.01);
          reflectVelocity(this, hit.nx, hit.ny);
        }
      }
    }

    return destroyed;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.type.color ?? "#e2e8f0";
    ctx.fill();
  }

  toJSONData() {
    return {
      id: this.id,
      typeId: this.typeId,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      radius: this.radius,
      damage: this.damage,
      data: this.data,
    };
  }

  static fromJSONData(raw) {
    if (!raw || typeof raw !== "object") return null;
    const typeId = typeof raw.typeId === "string" ? raw.typeId : "normal";
    const x = Number.isFinite(raw.x) ? raw.x : 100;
    const y = Number.isFinite(raw.y) ? raw.y : 100;
    const vx = Number.isFinite(raw.vx) ? raw.vx : 0;
    const vy = Number.isFinite(raw.vy) ? raw.vy : -420;

    return new Ball({
      id: typeof raw.id === "string" ? raw.id : null,
      typeId,
      x,
      y,
      vx,
      vy,
      radius: Number.isFinite(raw.radius) ? raw.radius : null,
      damage: Number.isFinite(raw.damage) ? raw.damage : null,
      data: raw.data && typeof raw.data === "object" ? raw.data : null,
    });
  }
}
