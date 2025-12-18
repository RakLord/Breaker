import { D, format } from "./numbers.js";
import { BlockGrid } from "./grid.js";
import { createBall } from "./balls.js";
import { parseSeedToUint32 } from "./rng.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function reflectVelocity(ball, nx, ny) {
  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx -= 2 * dot * nx;
  ball.vy -= 2 * dot * ny;
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

function stepBall(ball, dt, world, grid) {
  const speed = Math.hypot(ball.vx, ball.vy);
  const maxStep = Math.max(2, ball.radius * 0.75);
  const steps = clamp(Math.ceil((speed * dt) / maxStep), 1, 12);
  const stepDt = dt / steps;

  let destroyed = 0;

  for (let i = 0; i < steps; i++) {
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius > world.width) {
      ball.x = world.width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y + ball.radius > world.height) {
      ball.y = world.height - ball.radius;
      ball.vy = -Math.abs(ball.vy);
    }

    const hit = grid.findCircleCollision(ball.x, ball.y, ball.radius);
    if (hit) {
      destroyed += ball.type.onBlockHit({ grid, col: hit.col, row: hit.row, ball });

      if (ball.type.bounceOnBlocks) {
        ball.x += hit.nx * (hit.penetration + 0.01);
        ball.y += hit.ny * (hit.penetration + 0.01);
        reflectVelocity(ball, hit.nx, hit.ny);
      }
    }
  }

  return destroyed;
}

function drawBall(ctx, ball) {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.type.color ?? "#e2e8f0";
  ctx.fill();
}

function main() {
  const canvas = document.querySelector("#game-canvas");
  const patternSelect = document.querySelector("#pattern-select");
  const seedInput = document.querySelector("#seed-input");
  const regenBtn = document.querySelector("#regen-btn");
  const ballTypeSelect = document.querySelector("#balltype-select");
  const addBallBtn = document.querySelector("#addball-btn");
  const statsEl = document.querySelector("#stats");

  if (!canvas) throw new Error("Missing #game-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const world = { width: 800, height: 450 };
  const grid = new BlockGrid({ cellSize: 26, cols: 10, rows: 10 });

  const state = {
    points: D(0),
    balls: [],
    seed: parseSeedToUint32(seedInput?.value),
    pattern: patternSelect?.value ?? "noise",
  };

  function regenerate({ reseed = false } = {}) {
    state.pattern = patternSelect?.value ?? "noise";
    state.seed = reseed ? parseSeedToUint32(seedInput?.value) : state.seed;

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

  function addBallAt(x, y, typeId) {
    const angle = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
    const speed = 460 + Math.random() * 80;
    const ball = createBall({
      typeId,
      x,
      y,
      speed,
      angleRad: angle,
    });
    state.balls.push(ball);
  }

  regenBtn?.addEventListener("click", () => regenerate({ reseed: true }));
  addBallBtn?.addEventListener("click", () => {
    const typeId = ballTypeSelect?.value ?? "normal";
    addBallAt(world.width * 0.5, world.height * 0.85, typeId);
  });

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const typeId = ballTypeSelect?.value ?? "normal";
    addBallAt(x, y, typeId);
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
  regenerate({ reseed: true });
  addBallAt(world.width * 0.5, world.height * 0.85, "normal");

  let lastT = performance.now();
  let fpsSmoothed = 60;

  function frame(t) {
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;

    fpsSmoothed = fpsSmoothed * 0.93 + (1 / Math.max(1e-6, dt)) * 0.07;

    let destroyed = 0;
    for (const ball of state.balls) destroyed += stepBall(ball, dt, world, grid);
    if (destroyed > 0) state.points = state.points.add(destroyed);

    ctx.clearRect(0, 0, world.width, world.height);
    grid.draw(ctx);
    for (const ball of state.balls) drawBall(ctx, ball);

    if (statsEl) {
      statsEl.textContent = `Balls: ${state.balls.length} | Blocks: ${countAliveBlocks(
        grid
      )} | Points: ${format(state.points)} | FPS: ${fpsSmoothed.toFixed(0)}`;
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
