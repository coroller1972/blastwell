import { getLevelConfig, generatePrefill, hasFullLine } from "./levels.js";
import { PIECE_TYPES, cellsFor, makePiece, rotateMatrix } from "./pieces.js";

const SCORE_TABLE = {
  1: 10,
  2: 30,
  3: 50,
  4: 100
};

export class TetriSiloGame {
  constructor(options = {}) {
    this.seed = options.seed ?? 1337;
    this.level = options.level ?? 1;
    this.score = 0;
    this.totalLines = 0;
    this.levelLines = 0;
    this.status = "playing";
    this.lastClear = null;
    this.events = [];
    this._rngSeed = this.seed;
    this._dropAccumulator = 0;
    this._spawnQueue = [];
    if (options.autoStart === false) {
      this.prepareLevel(this.level, "ready");
    } else {
      this.startLevel(this.level);
    }
  }

  prepareLevel(level, status) {
    this.level = level;
    this.config = getLevelConfig(level, this.seed + level * 97);
    this.grid = generatePrefill(this.config);
    this.active = null;
    this.nextType = this.pickType();
    this.status = status;
    this.lastClear = null;
    this.levelLines = 0;
    this._dropAccumulator = 0;
  }

  startLevel(level) {
    this.prepareLevel(level, "playing");
    this.spawnPiece();
  }

  startPreparedLevel() {
    if (this.status !== "levelIntro") return false;
    this.status = "playing";
    this.spawnPiece();
    return true;
  }

  startGame() {
    this.score = 0;
    this.totalLines = 0;
    this.levelLines = 0;
    this._rngSeed = this.seed;
    this._spawnQueue = [];
    this.prepareLevel(1, "levelIntro");
    this.pushEvent("levelIntro", { level: this.level });
  }

  pickType() {
    if (this._spawnQueue.length > 0) {
      return this._spawnQueue.shift();
    }
    this._rngSeed = (this._rngSeed * 1103515245 + 12345) & 0x7fffffff;
    return PIECE_TYPES[this._rngSeed % PIECE_TYPES.length];
  }

  queuePieces(types) {
    this._spawnQueue.push(...types);
  }

  spawnPiece() {
    const type = this.nextType ?? this.pickType();
    this.active = makePiece(type, this.config.width);
    this.nextType = this.pickType();
    if (!this.canPlace(this.active)) {
      this.status = "gameOver";
    }
  }

  canPlace(piece) {
    return cellsFor(piece).every(({ x, y }) => {
      if (x < 0 || x >= this.config.width || y >= this.config.height) {
        return false;
      }
      return y < 0 || !this.grid[y][x];
    });
  }

  move(dx) {
    if (this.status !== "playing") return false;
    const moved = { ...this.active, x: this.active.x + dx };
    if (!this.canPlace(moved)) return false;
    this.active = moved;
    return true;
  }

  rotate(direction = 1) {
    if (this.status !== "playing") return false;
    const rotated = {
      ...this.active,
      matrix: rotateMatrix(this.active.matrix, direction)
    };
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      const candidate = { ...rotated, x: rotated.x + kick };
      if (this.canPlace(candidate)) {
        this.active = candidate;
        return true;
      }
    }
    return false;
  }

  softDrop() {
    if (this.status !== "playing") return false;
    return this.stepDown(true, "soft");
  }

  hardDrop() {
    if (this.status !== "playing") return false;
    while (this.stepDown(false, "hard")) {
      // Keep falling until collision.
    }
    this.lockPiece();
    return true;
  }

  stepDown(lockOnCollision = true, source = "gravity") {
    const dropped = { ...this.active, y: this.active.y + 1 };
    if (this.canPlace(dropped)) {
      this.active = dropped;
      this.pushEvent("tick", { source, y: this.active.y });
      return true;
    }
    if (lockOnCollision) {
      this.lockPiece();
    }
    return false;
  }

  lockPiece() {
    for (const { x, y } of cellsFor(this.active)) {
      if (y >= 0 && y < this.config.height) {
        this.grid[y][x] = { type: this.active.type };
      }
    }

    const rows = this.findFullRows();
    const bombs = this.findBombsInRows(rows);
    this.pushEvent("land", {
      pieceType: this.active.type,
      rows: rows.length
    });

    const bottomLineDestroyed = this.destroyedBottomLine(rows, bombs);
    if (rows.length > 0) {
      this.score += SCORE_TABLE[rows.length] ?? rows.length * 30;
      this.totalLines += rows.length;
      this.levelLines += rows.length;
      this.status = "clearing";
      this.lastClear = { rows, bottomLineDestroyed, bombs };
      this.active = null;
      this.pushEvent("clear", { rows, bottomLineDestroyed });
      if (bombs.length > 0) {
        this.pushEvent("bombArmed", { bombs });
      }
    } else {
      this.active = null;
      this.spawnPiece();
    }
  }

  findFullRows() {
    const rows = [];
    for (let y = 0; y < this.config.height; y += 1) {
      if (this.grid[y].every(Boolean)) {
        rows.push(y);
      }
    }
    return rows;
  }

  findBombsInRows(rows) {
    const rowSet = new Set(rows);
    const bombs = [];
    for (const y of rowSet) {
      for (let x = 0; x < this.config.width; x += 1) {
        if (this.grid[y][x]?.type === "bomb") {
          bombs.push({ x, y });
        }
      }
    }
    return bombs;
  }

  destroyedBottomLine(rows, bombs) {
    const bottom = this.config.height - 1;
    return rows.includes(bottom) || bombs.some((bomb) => bomb.y + this.bombRadius >= bottom);
  }

  applyClear() {
    if (this.status !== "clearing" || !this.lastClear) return;

    const rowsToClear = new Set(this.lastClear.rows);
    const remaining = this.grid.filter((_, y) => !rowsToClear.has(y));
    const newRows = Array.from({ length: rowsToClear.size }, () =>
      Array(this.config.width).fill(null)
    );
    this.grid = [...newRows, ...remaining];
    this.applyBombExplosions(this.lastClear.bombs ?? []);

    if (this.lastClear.bottomLineDestroyed) {
      this.prepareLevel(this.level + 1, "levelIntro");
      this.pushEvent("levelIntro", { level: this.level });
      return;
    }

    this.status = "playing";
    this.lastClear = null;
    this.spawnPiece();
  }

  applyBombExplosions(bombs) {
    for (const bomb of bombs) {
      for (let y = Math.max(0, bomb.y - this.bombRadius); y <= Math.min(this.config.height - 1, bomb.y + this.bombRadius); y += 1) {
        for (let x = Math.max(0, bomb.x - this.bombRadius); x <= Math.min(this.config.width - 1, bomb.x + this.bombRadius); x += 1) {
          const dx = x - bomb.x;
          const dy = y - bomb.y;
          if (Math.sqrt(dx * dx + dy * dy) <= this.bombRadius) {
            this.grid[y][x] = null;
          }
        }
      }
    }
  }

  update(deltaMs) {
    if (this.status !== "playing") return;
    this._dropAccumulator += deltaMs;
    const interval = this.dropIntervalMs;
    while (this._dropAccumulator >= interval && this.status === "playing") {
      this._dropAccumulator -= interval;
      this.stepDown(true, "gravity");
    }
  }

  pushEvent(type, detail = {}) {
    this.events.push({ type, ...detail });
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  action(actionName) {
    switch (actionName) {
      case "moveLeft":
        return this.move(-1);
      case "moveRight":
        return this.move(1);
      case "rotateCW":
        return this.rotate(1);
      case "rotateCCW":
        return this.rotate(-1);
      case "softDrop":
        return this.softDrop();
      case "hardDrop":
        return this.hardDrop();
      case "pause":
        if (this.status !== "playing" && this.status !== "paused") return false;
        this.status = this.status === "paused" ? "playing" : "paused";
        return true;
      case "restart":
        this.startGame();
        return true;
      default:
        return false;
    }
  }

  get dropIntervalMs() {
    const speedTier = Math.floor(this.levelLines / 10);
    return Math.max(110, Math.round(this.config.baseDropMs * 0.84 ** speedTier));
  }

  get speedLevel() {
    return Math.floor(this.levelLines / 10) + 1;
  }

  get bombRadius() {
    return 2;
  }

  snapshot() {
    return {
      grid: this.grid.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      active: this.active
        ? {
            type: this.active.type,
            x: this.active.x,
            y: this.active.y,
            matrix: this.active.matrix.map((row) => [...row])
          }
        : null,
      nextType: this.nextType,
      width: this.config.width,
      height: this.config.height,
      score: this.score,
      level: this.level,
      totalLines: this.totalLines,
      levelLines: this.levelLines,
      status: this.status,
      speedLevel: this.speedLevel,
      lastClear: this.lastClear
        ? {
            ...this.lastClear,
            rows: [...this.lastClear.rows],
            bombs: [...(this.lastClear.bombs ?? [])]
          }
        : null
    };
  }
}

export { hasFullLine };
