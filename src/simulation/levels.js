export const BOARD_HEIGHT = 24;
export const LEVEL_WIDTHS = [9, 11, 13, 15, 18, 25];
export const MIN_WIDTH = LEVEL_WIDTHS[0];
export const MAX_WIDTH = 25;

export function createRng(seed = Date.now()) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function getLevelConfig(level, seed) {
  const levelSeed = seed ?? 1000 + level * 7919;
  const width = LEVEL_WIDTHS[Math.min(level - 1, LEVEL_WIDTHS.length - 1)];
  const prefillRows = Math.min(BOARD_HEIGHT - 5, 14 + Math.floor(level / 3));
  return {
    level,
    width,
    height: BOARD_HEIGHT,
    baseDropMs: Math.max(220, 850 - (level - 1) * 42),
    prefillRows,
    seed: levelSeed
  };
}

export function emptyGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

export function hasFullLine(grid) {
  return grid.some((row) => row.every(Boolean));
}

export function generatePrefill(config) {
  const rng = createRng(config.seed ^ 0xb05b);
  const grid = emptyGrid(config.width, config.height);
  const startRow = config.height - config.prefillRows;
  const mirror = config.level % 2 === 0;
  const clampX = (x) => Math.max(0, Math.min(config.width - 1, x));
  const scaledX = (ratio) => clampX(Math.round(ratio * (config.width - 1)));
  const carve = (y, fromRatio, toRatio) => {
    const from = scaledX(mirror ? 1 - toRatio : fromRatio);
    const to = scaledX(mirror ? 1 - fromRatio : toRatio);
    for (let x = Math.min(from, to); x <= Math.max(from, to); x += 1) {
      grid[y][x] = null;
    }
  };
  const carveColumn = (y, ratio) => {
    grid[y][scaledX(mirror ? 1 - ratio : ratio)] = null;
  };

  for (let y = startRow; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      grid[y][x] = { type: "filler" };
    }
  }

  for (let y = startRow; y < config.height; y += 1) {
    const depth = (y - startRow) / Math.max(1, config.prefillRows - 1);
    const chimneyCenter = 0.5 + Math.sin(depth * Math.PI * 1.6 + config.level * 0.48) * 0.035;
    carveColumn(y, chimneyCenter);

    if (depth > 0.12 && depth < 0.34) carve(y, 0.31, 0.4);
    if (depth > 0.24 && depth < 0.48) carve(y, 0.61, 0.7);
    if (depth > 0.52 && depth < 0.78) carve(y, 0.36, 0.46);
    if (depth > 0.68 && depth < 0.88) carve(y, 0.59, 0.66);
  }

  protectBottomRows(grid, config);
  placeBombs(grid, config, rng);

  return grid;
}

export function bombCountForWidth(width) {
  return Math.max(2, Math.min(7, Math.round(2 + ((width - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 5)));
}

function placeBombs(grid, config, rng) {
  const candidates = [];
  const startRow = config.height - config.prefillRows;
  for (let y = startRow + 1; y < config.height - 1; y += 1) {
    for (let x = 1; x < config.width - 1; x += 1) {
      if (grid[y][x]?.type === "filler") {
        candidates.push({ x, y });
      }
    }
  }

  const count = Math.min(bombCountForWidth(config.width), candidates.length);
  for (let placed = 0; placed < count; placed += 1) {
    const index = Math.floor(rng() * candidates.length);
    const [candidate] = candidates.splice(index, 1);
    grid[candidate.y][candidate.x] = { type: "bomb" };
  }
}

function protectBottomRows(grid, config) {
  const protectedRows = [config.height - 1, config.height - 2];
  const gapRatios = [0.12, 0.3, 0.5, 0.7, 0.88];

  for (const y of protectedRows) {
    for (const ratio of gapRatios) {
      const x = Math.max(0, Math.min(config.width - 1, Math.round(ratio * (config.width - 1))));
      grid[y][x] = null;
    }
  }
}
