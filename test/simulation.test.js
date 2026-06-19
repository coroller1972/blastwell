import { describe, expect, it } from "vitest";
import { TetriSiloGame, hasFullLine } from "../src/simulation/game.js";
import { LEVEL_WIDTHS, MAX_WIDTH, MIN_WIDTH, bombCountForWidth, getLevelConfig, generatePrefill } from "../src/simulation/levels.js";
import { PIECES, PIECE_TYPES, makePiece } from "../src/simulation/pieces.js";
import { classifyTouchGesture } from "../src/input/touchControls.js";
import { LevelMusic } from "../src/audio/levelMusic.js";

describe("TETRI-SILO simulation", () => {
  it("includes the S and Z bias tetriminoes", () => {
    expect(PIECES.Z).toEqual([
      [1, 1, 0],
      [0, 1, 1]
    ]);
    expect(PIECES.S).toEqual([
      [0, 1, 1],
      [1, 1, 0]
    ]);
    expect(PIECE_TYPES).toContain("Z");
    expect(PIECE_TYPES).toContain("S");
  });

  it("centers the S and Z pieces when spawning", () => {
    expect(makePiece("Z", 9)).toMatchObject({ type: "Z", x: 3, y: -1 });
    expect(makePiece("S", 9)).toMatchObject({ type: "S", x: 3, y: -1 });
  });

  it("can prepare a level without starting the falling piece", () => {
    const game = new TetriSiloGame({ seed: 4, autoStart: false });

    expect(game.status).toBe("ready");
    expect(game.active).toBeNull();
    expect(game.snapshot().nextType).toBeTruthy();
    expect(game.action("pause")).toBe(false);

    game.startGame();

    expect(game.status).toBe("levelIntro");
    expect(game.active).toBeNull();
    expect(game.startPreparedLevel()).toBe(true);
    expect(game.status).toBe("playing");
    expect(game.active).toBeTruthy();
  });

  it("generates a prefilled well without completed lines", () => {
    for (let level = 1; level <= 9; level += 1) {
      const config = getLevelConfig(level, 1234 + level);
      const grid = generatePrefill(config);
      expect(hasFullLine(grid)).toBe(false);
    }
  });

  it("keeps a narrow chimney outlet in the bottom line", () => {
    for (let level = 1; level <= LEVEL_WIDTHS.length; level += 1) {
      const config = getLevelConfig(level, 4300 + level);
      const grid = generatePrefill(config);
      const emptyBottomCells = grid[config.height - 1].filter((cell) => !cell).length;

      expect(emptyBottomCells).toBeGreaterThanOrEqual(1);
      expect(emptyBottomCells).toBeLessThanOrEqual(2);
    }
  });

  it("does not complete the level on the first hard drop", () => {
    for (let level = 1; level <= LEVEL_WIDTHS.length; level += 1) {
      const game = new TetriSiloGame({ seed: 6000 + level, level });
      game.hardDrop();

      expect(game.lastClear?.bottomLineDestroyed).not.toBe(true);
    }
  });

  it("keeps visible cavities in the initial wall shape", () => {
    const config = getLevelConfig(1, 1442);
    const grid = generatePrefill(config);
    const filledRows = grid.filter((row) => row.some(Boolean));

    expect(filledRows.length).toBeGreaterThan(10);
    for (const row of filledRows) {
      expect(row.some((cell) => !cell)).toBe(true);
    }
  });

  it("places the expected number of bombs on initial filled bricks", () => {
    for (let level = 1; level <= LEVEL_WIDTHS.length; level += 1) {
      const config = getLevelConfig(level, 9000 + level);
      const grid = generatePrefill(config);
      const bombs = grid.flat().filter((cell) => cell?.type === "bomb");

      expect(bombs).toHaveLength(bombCountForWidth(config.width));
      expect(bombs.length).toBeGreaterThanOrEqual(2);
      expect(bombs.length).toBeLessThanOrEqual(7);

      for (let y = 0; y < config.height; y += 1) {
        for (let x = 0; x < config.width; x += 1) {
          if (grid[y][x]?.type !== "bomb") continue;
          const touchesCavity = [-1, 0, 1].some((dy) =>
            [-1, 0, 1].some((dx) => {
              if (dx === 0 && dy === 0) return false;
              return grid[y + dy]?.[x + dx] === null;
            })
          );
          expect(touchesCavity).toBe(true);
        }
      }
    }
  });

  it("decorates the excavated silhouette without changing gameplay cells", () => {
    const config = getLevelConfig(5, 7331);
    const grid = generatePrefill(config);
    const rimBricks = grid.flat().filter((cell) => cell?.visualVariant?.startsWith("rim-"));

    expect(rimBricks.length).toBeGreaterThan(10);
    expect(rimBricks.every((cell) => cell.type === "filler")).toBe(true);
    expect(rimBricks.every((cell) => cell.depthOffset < 0)).toBe(true);
    expect(new Set(rimBricks.map((cell) => cell.visualVariant)).size).toBe(2);
  });

  it("sculpts an offset circular cavity with winding chimneys", () => {
    const config = getLevelConfig(3, 2024);
    const grid = generatePrefill(config);
    const startRow = config.height - config.prefillRows;
    const openCellsByRow = grid.slice(startRow).map((row) => row.filter((cell) => !cell).length);
    const widestRow = openCellsByRow.indexOf(Math.max(...openCellsByRow));
    const openXs = grid[startRow + widestRow]
      .map((cell, x) => (!cell ? x : -1))
      .filter((x) => x >= 0);
    const cavityCenter = openXs.reduce((sum, x) => sum + x, 0) / openXs.length;
    const boardCenter = (config.width - 1) / 2;

    expect(Math.min(...openCellsByRow)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...openCellsByRow)).toBeGreaterThanOrEqual(5);
    expect(cavityCenter).toBeGreaterThan(boardCenter);

    const narrowRows = openCellsByRow.filter((count) => count <= 2);
    expect(narrowRows.length).toBeGreaterThanOrEqual(4);

    const topChimneyXs = grid.slice(startRow, startRow + 4).map((row) => row.findIndex((cell) => !cell));
    const bottomChimneyXs = grid.slice(-4).map((row) => row.findIndex((cell) => !cell));
    expect(new Set(topChimneyXs).size).toBeGreaterThan(1);
    expect(new Set(bottomChimneyXs).size).toBeGreaterThan(1);
  });

  it("uses the fixed six-level board width sequence", () => {
    const widths = Array.from({ length: 6 }, (_, index) => getLevelConfig(index + 1).width);

    expect(widths).toEqual(LEVEL_WIDTHS);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(MIN_WIDTH);
    expect(Math.max(...widths)).toBeLessThanOrEqual(MAX_WIDTH);
    expect(getLevelConfig(7).width).toBe(MAX_WIDTH);
  });

  it("keeps horizontal movement bounded", () => {
    const game = new TetriSiloGame({ seed: 4 });
    game.active = { type: "I", matrix: [[1, 1, 1, 1]], x: 0, y: 0 };
    expect(game.move(-1)).toBe(false);
    game.active.x = game.config.width - 4;
    expect(game.move(1)).toBe(false);
  });

  it("projects a ghost piece at the lowest valid position", () => {
    const game = new TetriSiloGame({ seed: 4 });
    game.grid = game.grid.map((row) => row.map(() => null));
    game.active = { type: "O", matrix: [[1, 1], [1, 1]], x: 3, y: 0 };

    const ghost = game.snapshot().ghost;

    expect(ghost.y).toBe(game.config.height - 2);
    expect(game.active.y).toBe(0);
    expect(ghost.matrix).toEqual(game.active.matrix);
  });

  it("maps taps and swipes to touch actions", () => {
    expect(classifyTouchGesture(4, 3, 120)).toEqual({ action: "rotatePrimary", repetitions: 1 });
    expect(classifyTouchGesture(-82, 8, 420)).toEqual({ action: "moveLeft", repetitions: 2 });
    expect(classifyTouchGesture(94, 12, 420)).toEqual({ action: "moveRight", repetitions: 2 });
    expect(classifyTouchGesture(8, 110, 220)).toEqual({ action: "hardDrop", repetitions: 1 });
    expect(classifyTouchGesture(6, 70, 520)).toEqual({ action: "softDrop", repetitions: 2 });
  });

  it("can mute music independently from sound effects", () => {
    const music = new LevelMusic({});

    music.setEnabled(false);
    music.resume();
    music.sync({ status: "playing", level: 1 });

    expect(music.enabled).toBe(false);
    expect(music.audio).toBeNull();
  });

  it("emits tick, land, and clear events for sound effects", () => {
    const game = new TetriSiloGame({ seed: 5 });
    game.grid = game.grid.map((row) => row.map(() => null));
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };
    expect(game.softDrop()).toBe(true);
    expect(game.drainEvents().map((event) => event.type)).toContain("tick");

    const row = game.config.height - 1;
    game.grid[row] = Array(game.config.width).fill({ type: "filler" });
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };
    game.lockPiece();

    const events = game.drainEvents().map((event) => event.type);
    expect(events).toContain("land");
    expect(events).toContain("clear");
  });

  it("emits a bomb event when a completed row contains a bomb", () => {
    const game = new TetriSiloGame({ seed: 5 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const row = game.config.height - 6;
    game.grid[row] = Array(game.config.width).fill({ type: "filler" });
    game.grid[row][Math.floor(game.config.width / 2)] = { type: "bomb" };
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };

    game.lockPiece();

    const events = game.drainEvents().map((event) => event.type);
    expect(events).toContain("bombArmed");
    expect(game.lastClear.bombs).toHaveLength(1);
    expect(game.grid[row][Math.floor(game.config.width / 2)]?.type).toBe("bomb");
  });

  it("creates a smaller circular cavity after a detonated bomb line resolves", () => {
    const game = new TetriSiloGame({ seed: 5 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const x = Math.floor(game.config.width / 2);
    const y = game.config.height - 7;
    for (let yy = y - 2; yy <= y + 2; yy += 1) {
      for (let xx = x - 2; xx <= x + 2; xx += 1) {
        if (yy >= 0 && yy < game.config.height && xx >= 0 && xx < game.config.width) {
          game.grid[yy][xx] = { type: "filler" };
        }
      }
    }
    game.grid[y] = Array(game.config.width).fill({ type: "filler" });
    game.grid[y][x] = { type: "bomb" };
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };
    game.lockPiece();
    expect(game.status).toBe("clearing");
    game.applyClear();

    expect(game.grid[y][x]).toBeNull();
    expect(game.grid[y - 1][x]).toBeNull();
    expect(game.grid[y][x + 2]).toBeNull();
    expect(game.status).toBe("playing");
  });

  it("detonates nearby bombs as a depth-ordered chain reaction", () => {
    const game = new TetriSiloGame({ seed: 51 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const x = Math.floor(game.config.width / 2);
    const row = game.config.height - 8;
    game.grid[row] = Array(game.config.width).fill({ type: "filler" });
    game.grid[row][x] = { type: "bomb" };
    game.grid[row - 2][x] = { type: "bomb" };
    game.grid[row - 4][x] = { type: "bomb" };
    game.grid[row - 4][x + 3] = { type: "bomb" };
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };

    game.lockPiece();

    expect(game.lastClear.bombs).toEqual([
      { x, y: row, chainDepth: 0, triggerX: x },
      { x, y: row - 2, chainDepth: 1, triggerX: x },
      { x, y: row - 4, chainDepth: 2, triggerX: x }
    ]);

    game.applyClear();
    expect(game.grid[row - 1][x]).toBeNull();
    expect(game.grid[row - 3][x]).toBeNull();
    expect(game.grid[row - 3][x + 3]?.type).toBe("bomb");
  });

  it("rotates pieces when there is room", () => {
    const game = new TetriSiloGame({ seed: 6 });
    game.active = {
      type: "L",
      matrix: [
        [1, 0, 0],
        [1, 1, 1]
      ],
      x: 3,
      y: 4
    };
    expect(game.rotate(1)).toBe(true);
    expect(game.active.matrix).toEqual([
      [1, 1],
      [1, 0],
      [1, 0]
    ]);
  });

  it("scores cleared lines with the configured table", () => {
    const game = new TetriSiloGame({ seed: 8 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const bottom = game.config.height - 1;
    game.grid[bottom] = Array(game.config.width).fill({ type: "filler" });
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };

    game.lockPiece();
    expect(game.status).toBe("clearing");
    expect(game.score).toBe(10);
    expect(game.totalLines).toBe(1);
  });

  it("increases speed every 10 destroyed lines", () => {
    const game = new TetriSiloGame({ seed: 10 });
    const initial = game.dropIntervalMs;
    expect(game.speedLevel).toBe(1);
    game.levelLines = 10;
    expect(game.dropIntervalMs).toBeLessThan(initial);
    expect(game.speedLevel).toBe(2);
  });

  it("resets speed when a new level starts", () => {
    const game = new TetriSiloGame({ seed: 10 });
    game.levelLines = 10;
    expect(game.speedLevel).toBe(2);

    game.startLevel(2);

    expect(game.levelLines).toBe(0);
    expect(game.speedLevel).toBe(1);
  });

  it("advances level after the bottom line is destroyed", () => {
    const game = new TetriSiloGame({ seed: 12 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const bottom = game.config.height - 1;
    game.grid[bottom] = Array(game.config.width).fill({ type: "filler" });
    game.lockPiece();
    expect(game.lastClear.bottomLineDestroyed).toBe(true);
    game.applyClear();
    expect(game.level).toBe(2);
    expect(game.status).toBe("levelIntro");
    expect(game.active).toBeNull();
    expect(game.config.width).toBeGreaterThanOrEqual(MIN_WIDTH);
    expect(game.config.width).toBeLessThanOrEqual(MAX_WIDTH);

    expect(game.startPreparedLevel()).toBe(true);
    expect(game.status).toBe("playing");
    expect(game.active).toBeTruthy();
  });

  it("advances level after multiple lines are destroyed including the bottom line", () => {
    const game = new TetriSiloGame({ seed: 12 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const bottom = game.config.height - 1;
    game.grid[bottom - 1] = Array(game.config.width).fill({ type: "filler" });
    game.grid[bottom] = Array(game.config.width).fill({ type: "filler" });
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };

    game.lockPiece();

    expect(game.lastClear.rows).toEqual([bottom - 1, bottom]);
    expect(game.lastClear.bottomLineDestroyed).toBe(true);
    game.applyClear();
    expect(game.level).toBe(2);
    expect(game.status).toBe("levelIntro");
  });

  it("advances level when a bomb blast reaches the bottom line", () => {
    const game = new TetriSiloGame({ seed: 12 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const row = game.config.height - 3;
    game.grid[row] = Array(game.config.width).fill({ type: "filler" });
    game.grid[row][Math.floor(game.config.width / 2)] = { type: "bomb" };
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };

    game.lockPiece();

    expect(game.lastClear.bottomLineDestroyed).toBe(true);
    game.applyClear();
    expect(game.level).toBe(2);
    expect(game.status).toBe("levelIntro");
  });

  it("removes completed rows after the clear animation finishes", () => {
    const game = new TetriSiloGame({ seed: 18 });
    game.grid = game.grid.map((row) => row.map(() => null));
    const row = game.config.height - 3;
    game.grid[row] = Array(game.config.width).fill({ type: "filler" });
    game.active = { type: "O", matrix: [[1]], x: 0, y: 0 };

    game.lockPiece();
    expect(game.lastClear.rows).toEqual([row]);
    game.applyClear();

    expect(game.grid[row].every(Boolean)).toBe(false);
    expect(game.status).toBe("playing");
  });
});
