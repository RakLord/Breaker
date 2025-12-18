import { valueNoise2D } from "./rng.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export const GRID_PATTERNS = {
  noise: ({ col, row, seed, noiseScale }) => {
    const nx = col * noiseScale;
    const ny = row * noiseScale;
    return valueNoise2D(nx, ny, seed);
  },
  checker: ({ col, row }) => ((col + row) & 1 ? 0.25 : 0.85),
  stripes: ({ row, rows }) => {
    const t = rows <= 1 ? 0 : row / (rows - 1);
    return 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * Math.PI * 8));
  },
  diamond: ({ col, row, cols, rows }) => {
    const cx = (cols - 1) * 0.5;
    const cy = (rows - 1) * 0.5;
    const d = Math.abs(col - cx) + Math.abs(row - cy);
    const maxD = cx + cy || 1;
    return 1 - clamp(d / maxD, 0, 1);
  },
};

export class BlockGrid {
  constructor({ cellSize, cols, rows, originX = 0, originY = 0 } = {}) {
    this.cellSize = cellSize ?? 28;
    this.originX = originX;
    this.originY = originY;

    this.cols = 0;
    this.rows = 0;
    this.hp = new Float64Array(0);
    this.maxHp = new Float64Array(0);
    this.resize(cols ?? 10, rows ?? 10);
  }

  resize(cols, rows) {
    const nextCols = Math.max(1, cols | 0);
    const nextRows = Math.max(1, rows | 0);
    if (nextCols === this.cols && nextRows === this.rows) return;

    this.cols = nextCols;
    this.rows = nextRows;
    const size = this.cols * this.rows;
    this.hp = new Float64Array(size);
    this.maxHp = new Float64Array(size);
  }

  clear() {
    this.hp.fill(0);
    this.maxHp.fill(0);
  }

  index(col, row) {
    return row * this.cols + col;
  }

  inBounds(col, row) {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  damageIndex(index, amount) {
    const prev = this.hp[index];
    if (prev <= 0) return 0;
    const next = prev - amount;
    this.hp[index] = next > 0 ? next : 0;
    return prev > 0 && this.hp[index] <= 0 ? 1 : 0;
  }

  damageCell(col, row, amount) {
    if (!this.inBounds(col, row)) return 0;
    return this.damageIndex(this.index(col, row), amount);
  }

  damageRadiusCells(centerCol, centerRow, radiusCells, amount, { includeCenter = true } = {}) {
    const r = Math.max(0, radiusCells | 0);
    const r2 = r * r;
    let destroyed = 0;

    const minCol = Math.max(0, centerCol - r);
    const maxCol = Math.min(this.cols - 1, centerCol + r);
    const minRow = Math.max(0, centerRow - r);
    const maxRow = Math.min(this.rows - 1, centerRow + r);

    for (let row = minRow; row <= maxRow; row++) {
      const dy = row - centerRow;
      for (let col = minCol; col <= maxCol; col++) {
        const dx = col - centerCol;
        if (dx * dx + dy * dy > r2) continue;
        if (!includeCenter && dx === 0 && dy === 0) continue;
        destroyed += this.damageCell(col, row, amount);
      }
    }
    return destroyed;
  }

  generate({
    pattern = "noise",
    seed = 1,
    noiseScale = 0.18,
    fill = 0.68,
    hpMin = 2,
    hpMax = 10,
    filledRowsRatio = 0.55,
    emptyBorder = 1,
  } = {}) {
    this.clear();
    const pat = GRID_PATTERNS[pattern] ?? GRID_PATTERNS.noise;

    const filledRows = Math.max(0, Math.min(this.rows, Math.floor(this.rows * filledRowsRatio)));
    const maxFill = clamp(fill, 0, 1);
    const minHp = Math.max(0, hpMin);
    const maxHp = Math.max(minHp, hpMax);

    for (let row = 0; row < filledRows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (
          col < emptyBorder ||
          col >= this.cols - emptyBorder ||
          row < emptyBorder ||
          row >= filledRows - emptyBorder
        ) {
          continue;
        }

        const v = pat({
          col,
          row,
          cols: this.cols,
          rows: filledRows,
          seed,
          noiseScale,
        });

        if (v < 1 - maxFill) continue;
        const t = clamp((v - (1 - maxFill)) / (maxFill || 1), 0, 1);
        const hp = minHp + t * (maxHp - minHp);

        const idx = this.index(col, row);
        this.hp[idx] = hp;
        this.maxHp[idx] = hp;
      }
    }
  }

  findCircleCollision(x, y, radius) {
    const r = radius;
    const cell = this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    const localX = x - ox;
    const localY = y - oy;

    const minCol = clamp(Math.floor((localX - r) / cell), 0, this.cols - 1);
    const maxCol = clamp(Math.floor((localX + r) / cell), 0, this.cols - 1);
    const minRow = clamp(Math.floor((localY - r) / cell), 0, this.rows - 1);
    const maxRow = clamp(Math.floor((localY + r) / cell), 0, this.rows - 1);

    let best = null;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const idx = this.index(col, row);
        if (this.hp[idx] <= 0) continue;

        const x0 = ox + col * cell;
        const y0 = oy + row * cell;
        const x1 = x0 + cell;
        const y1 = y0 + cell;

        const closestX = clamp(x, x0, x1);
        const closestY = clamp(y, y0, y1);
        const dx = x - closestX;
        const dy = y - closestY;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > r * r) continue;

        let nx = 0;
        let ny = 0;
        let penetration = 0;

        if (dist2 > 1e-10) {
          const dist = Math.sqrt(dist2);
          nx = dx / dist;
          ny = dy / dist;
          penetration = r - dist;
        } else {
          const penLeft = x - x0 + r;
          const penRight = x1 + r - x;
          const penTop = y - y0 + r;
          const penBottom = y1 + r - y;
          penetration = penLeft;
          nx = -1;
          ny = 0;

          if (penRight < penetration) {
            penetration = penRight;
            nx = 1;
            ny = 0;
          }
          if (penTop < penetration) {
            penetration = penTop;
            nx = 0;
            ny = -1;
          }
          if (penBottom < penetration) {
            penetration = penBottom;
            nx = 0;
            ny = 1;
          }
        }

        if (!best || penetration > best.penetration) {
          best = { col, row, index: idx, nx, ny, penetration };
        }
      }
    }

    return best;
  }

  draw(ctx, { showEmpty = false } = {}) {
    const cell = this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    ctx.save();
    ctx.translate(ox, oy);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const idx = this.index(col, row);
        const hp = this.hp[idx];
        if (hp <= 0) {
          if (!showEmpty) continue;
          ctx.strokeStyle = "rgba(148,163,184,0.10)";
          ctx.lineWidth = 1;
          ctx.strokeRect(col * cell + 0.5, row * cell + 0.5, cell - 1, cell - 1);
          continue;
        }

        const maxHp = this.maxHp[idx] || hp;
        const t = clamp(hp / maxHp, 0, 1);
        const hue = 210 + (1 - t) * 80;
        const light = 48 + t * 10;
        ctx.fillStyle = `hsl(${hue} 75% ${light}%)`;
        ctx.fillRect(col * cell + 1, row * cell + 1, cell - 2, cell - 2);
      }
    }

    ctx.restore();
  }
}
