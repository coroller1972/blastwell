export const BOARD_HEIGHT = 24;
export const LEVEL_WIDTHS = [9, 11, 13, 15, 18, 25];
export const MIN_WIDTH = LEVEL_WIDTHS[0];
export const MAX_WIDTH = 25;

const WELL_PROFILES = [
  { radiusRatio: 0.25, depth: 0.43, offsetRatio: 0.1, bend: 1, frequency: 0.82, topPhase: 0.2, bottomPhase: 2.5 },
  { radiusRatio: 0.22, depth: 0.5, offsetRatio: 0.14, bend: 1, frequency: 1.02, topPhase: 1.1, bottomPhase: 3.4 },
  { radiusRatio: 0.2, depth: 0.56, offsetRatio: 0.17, bend: 1, frequency: 1.18, topPhase: 2.2, bottomPhase: 0.5 },
  { radiusRatio: 0.18, depth: 0.46, offsetRatio: 0.18, bend: 2, frequency: 0.9, topPhase: 2.8, bottomPhase: 4.6 },
  { radiusRatio: 0.16, depth: 0.58, offsetRatio: 0.2, bend: 2, frequency: 1.08, topPhase: 0.7, bottomPhase: 3.1 },
  { radiusRatio: 0.14, depth: 0.51, offsetRatio: 0.22, bend: 2, frequency: 1.27, topPhase: 1.8, bottomPhase: 5.2 }
];

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
  const profile = WELL_PROFILES[Math.min(config.level - 1, WELL_PROFILES.length - 1)];

  for (let y = startRow; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      grid[y][x] = { type: "filler" };
    }
  }

  const radius = clamp(Math.round(config.width * profile.radiusRatio), 2, 4);
  const horizontalOffset = Math.max(1, Math.round(config.width * profile.offsetRatio));
  const side = config.level % 2 === 0 ? -1 : 1;
  const centerX = clamp(Math.floor(config.width / 2) + side * horizontalOffset, radius + 1, config.width - radius - 2);
  const centerY = clamp(
    startRow + Math.round((config.prefillRows - 1) * profile.depth),
    startRow + radius + 2,
    config.height - radius - 3
  );

  carveCircularCavity(grid, centerX, centerY, radius);
  carveWindingChimney(grid, centerY - radius, startRow, centerX, rng, {
    amplitude: profile.bend,
    frequency: profile.frequency,
    phase: profile.topPhase
  });
  carveWindingChimney(grid, centerY + radius, config.height - 1, centerX, rng, {
    amplitude: profile.bend,
    frequency: profile.frequency * 1.08,
    phase: profile.bottomPhase
  });

  placeBombs(grid, config, rng);
  decorateCavityRim(grid, config, startRow);

  return grid;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function carveCircularCavity(grid, centerX, centerY, radius) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2 + 0.25) {
        grid[y][x] = null;
      }
    }
  }
}

function carveWindingChimney(grid, fromY, toY, startX, rng, options) {
  const direction = Math.sign(toY - fromY);
  const minX = 1;
  const maxX = grid[0].length - 2;
  const randomPhase = options.phase + rng() * 0.55;
  let x = startX;

  for (let y = fromY, distance = 0; ; y += direction, distance += 1) {
    const targetX = clamp(
      startX + Math.round(Math.sin(distance * options.frequency + randomPhase) * options.amplitude),
      minX,
      maxX
    );
    const nextX = clamp(targetX, x - 1, x + 1);

    for (let carvedX = Math.min(x, nextX); carvedX <= Math.max(x, nextX); carvedX += 1) {
      grid[y][carvedX] = null;
    }
    x = nextX;

    if (y === toY) break;
  }
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
        candidates.push({ x, y, proximity: emptyNeighborScore(grid, x, y) });
      }
    }
  }

  const count = Math.min(bombCountForWidth(config.width), candidates.length);
  for (let placed = 0; placed < count; placed += 1) {
    const nearCavity = candidates.filter((candidate) => candidate.proximity > 0);
    const pool = nearCavity.length > 0 ? nearCavity : candidates;
    const indexInPool = weightedCandidateIndex(pool, rng);
    const selected = pool[indexInPool];
    const index = candidates.indexOf(selected);
    const [candidate] = candidates.splice(index, 1);
    grid[candidate.y][candidate.x] = { type: "bomb" };
  }
}

function emptyNeighborScore(grid, x, y) {
  let score = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const row = grid[y + dy];
      if (row && x + dx >= 0 && x + dx < row.length && !row[x + dx]) {
        score += dx === 0 || dy === 0 ? 3 : 1;
      }
    }
  }
  return score;
}

function weightedCandidateIndex(candidates, rng) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.proximity + 1, 0);
  let cursor = rng() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= candidates[index].proximity + 1;
    if (cursor <= 0) return index;
  }
  return candidates.length - 1;
}

function decorateCavityRim(grid, config, startRow) {
  for (let y = startRow; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      const cell = grid[y][x];
      if (cell?.type !== "filler" || emptyNeighborScore(grid, x, y) === 0) continue;

      const hash = ((x + 1) * 73856093 ^ (y + 1) * 19349663 ^ config.seed) >>> 0;
      cell.visualVariant = hash % 3 === 0 ? "rim-light" : "rim-dark";
      cell.depthOffset = -(0.035 + (hash % 5) * 0.012);
    }
  }
}
