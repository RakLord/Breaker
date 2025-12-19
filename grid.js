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

  toJSONData() {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
      originX: this.originX,
      originY: this.originY,
      hp: Array.from(this.hp),
      maxHp: Array.from(this.maxHp),
    };
  }

  applyJSONData(raw, { maxCols = 200, maxRows = 200, maxCells = 40000 } = {}) {
    if (!raw || typeof raw !== "object") return false;

    const cols = Math.max(1, raw.cols | 0);
    const rows = Math.max(1, raw.rows | 0);
    const size = cols * rows;
    if (cols > maxCols || rows > maxRows || size > maxCells) return false;

    const hp = Array.isArray(raw.hp) ? raw.hp : null;
    const maxHp = Array.isArray(raw.maxHp) ? raw.maxHp : null;
    if (!hp || !maxHp || hp.length !== size || maxHp.length !== size) return false;

    const cellSize = Number.isFinite(raw.cellSize) ? raw.cellSize : this.cellSize;
    if (Number.isFinite(cellSize) && cellSize > 0) this.cellSize = cellSize;

    const originX = Number.isFinite(raw.originX) ? raw.originX : this.originX;
    const originY = Number.isFinite(raw.originY) ? raw.originY : this.originY;
    if (Number.isFinite(originX)) this.originX = originX;
    if (Number.isFinite(originY)) this.originY = originY;

    this.resize(cols, rows);
    for (let i = 0; i < size; i++) {
      const h = Number(hp[i]);
      const mh = Number(maxHp[i]);
      const safeHp = Number.isFinite(h) ? Math.max(0, h) : 0;
      const safeMaxHp = Number.isFinite(mh) ? Math.max(safeHp, mh) : safeHp;
      this.hp[i] = safeHp;
      this.maxHp[i] = safeMaxHp;
    }

    return true;
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

  applyDamageIndex(index, amount) {
    const prev = this.hp[index];
    if (prev <= 0 || amount <= 0) return { damageDealt: 0, destroyed: 0 };
    const next = prev - amount;
    this.hp[index] = next > 0 ? next : 0;
    const damageDealt = prev - this.hp[index];
    const destroyed = prev > 0 && this.hp[index] <= 0 ? 1 : 0;
    return { damageDealt, destroyed };
  }

  applyDamageCell(col, row, amount) {
    if (!this.inBounds(col, row)) return { damageDealt: 0, destroyed: 0 };
    return this.applyDamageIndex(this.index(col, row), amount);
  }

  damageIndex(index, amount) {
    return this.applyDamageIndex(index, amount).destroyed;
  }

  damageCell(col, row, amount) {
    return this.applyDamageCell(col, row, amount).destroyed;
  }

  applyDamageRadiusCells(centerCol, centerRow, radiusCells, amount, { includeCenter = true } = {}) {
    const r = Math.max(0, radiusCells | 0);
    const r2 = r * r;
    let damageDealt = 0;
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
        const res = this.applyDamageCell(col, row, amount);
        damageDealt += res.damageDealt;
        destroyed += res.destroyed;
      }
    }
    return { damageDealt, destroyed };
  }

  applyDamageRow(row, amount, { excludeCol = null } = {}) {
    const r = row | 0;
    if (r < 0 || r >= this.rows) return { damageDealt: 0, destroyed: 0 };
    let damageDealt = 0;
    let destroyed = 0;

    for (let col = 0; col < this.cols; col++) {
      if (excludeCol !== null && col === excludeCol) continue;
      const res = this.applyDamageCell(col, r, amount);
      damageDealt += res.damageDealt;
      destroyed += res.destroyed;
    }

    return { damageDealt, destroyed };
  }

  damageRadiusCells(centerCol, centerRow, radiusCells, amount, { includeCenter = true } = {}) {
    return this.applyDamageRadiusCells(centerCol, centerRow, radiusCells, amount, { includeCenter }).destroyed;
  }

  generate({
    pattern = "noise",
    seed = 1,
    noiseScale = 0.18,
    // If set (0..1), noise cells are filled when normalizedNoise >= noiseThreshold.
    // Higher values => more holes (fewer blocks). Takes precedence over `fill` for `pattern: "noise"`.
    noiseThreshold = null,
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
    const useNoiseThreshold = pattern === "noise" && Number.isFinite(noiseThreshold);
    const threshold = useNoiseThreshold ? clamp(noiseThreshold, 0, 1) : null;

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
        const v01 = clamp(v, 0, 1);

        if (threshold !== null) {
          if (v01 < threshold) continue;
        } else {
          if (v01 < 1 - maxFill) continue;
        }

        const denom = threshold !== null ? Math.max(1e-9, 1 - threshold) : maxFill || 1;
        const offset = threshold !== null ? threshold : 1 - maxFill;
        const t = clamp((v01 - offset) / denom, 0, 1);
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

  draw(ctx, { showEmpty = false, showHp = false } = {}) {
    const cell = this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    const showHpText = showHp && cell >= 14;
    const fontSize = showHpText ? Math.max(8, Math.floor(cell * 0.42)) : 0;
    const textColor = "rgba(248,250,252,0.9)";

    ctx.save();
    ctx.translate(ox, oy);
    if (showHpText) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fontSize}px sans-serif`;
    }

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
        if (showHpText) {
          const label = Math.round(hp).toString();
          const x = col * cell + cell * 0.5;
          const y = row * cell + cell * 0.5;
          ctx.fillStyle = textColor;
          ctx.fillText(label, x, y);
        }
      }
    }

    ctx.restore();
  }

  hasAliveBlockWithinRadius(x, y, radiusPx) {
    const r = Math.max(0, radiusPx);
    const cell = this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    const minCol = clamp(Math.floor((x - ox - r) / cell), 0, this.cols - 1);
    const maxCol = clamp(Math.floor((x - ox + r) / cell), 0, this.cols - 1);
    const minRow = clamp(Math.floor((y - oy - r) / cell), 0, this.rows - 1);
    const maxRow = clamp(Math.floor((y - oy + r) / cell), 0, this.rows - 1);

    const r2 = r * r;
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
        if (dx * dx + dy * dy <= r2) return true;
      }
    }

    return false;
  }

  getRandomAliveBlockOutsideRadius(x, y, radiusPx) {
    const r = Math.max(0, radiusPx);
    const r2 = r * r;
    const cell = this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    const candidates = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const idx = this.index(col, row);
        if (this.hp[idx] <= 0) continue;

        const cx = ox + col * cell + cell * 0.5;
        const cy = oy + row * cell + cell * 0.5;
        const dx = cx - x;
        const dy = cy - y;
        if (dx * dx + dy * dy < r2) continue;
        candidates.push({ x: cx, y: cy, col, row, index: idx });
      }
    }

    if (candidates.length === 0) return null;
    return candidates[(Math.random() * candidates.length) | 0];
  }

  getFarthestAliveBlock(x, y) {
    const cell = this.cellSize;
    const ox = this.originX;
    const oy = this.originY;

    let best = null;
    let bestD2 = -1;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const idx = this.index(col, row);
        if (this.hp[idx] <= 0) continue;

        const cx = ox + col * cell + cell * 0.5;
        const cy = oy + row * cell + cell * 0.5;
        const dx = cx - x;
        const dy = cy - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > bestD2) {
          bestD2 = d2;
          best = { x: cx, y: cy, col, row, index: idx };
        }
      }
    }

    return best;
  }
}
