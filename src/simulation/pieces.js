export const PIECES = {
  O: [
    [1, 1],
    [1, 1]
  ],
  I: [[1, 1, 1, 1]],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  L: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  J: [
    [0, 0, 1],
    [1, 1, 1]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ]
};

export const PIECE_TYPES = Object.keys(PIECES);

export const PIECE_COLORS = {
  O: 0xb86f61,
  I: 0xc38272,
  T: 0xa85c55,
  L: 0xd0977f,
  J: 0x8f4945,
  Z: 0xbc6751,
  S: 0x7f5d45,
  filler: 0x9d5c52,
  bomb: 0x2b2424
};

export function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

export function rotateMatrix(matrix, direction = 1) {
  const height = matrix.length;
  const width = matrix[0].length;
  const rotated = Array.from({ length: width }, () => Array(height).fill(0));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (direction > 0) {
        rotated[x][height - 1 - y] = matrix[y][x];
      } else {
        rotated[width - 1 - x][y] = matrix[y][x];
      }
    }
  }

  return rotated;
}

export function cellsFor(piece) {
  const cells = [];
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (piece.matrix[y][x]) {
        cells.push({ x: piece.x + x, y: piece.y + y });
      }
    }
  }
  return cells;
}

export function makePiece(type, width) {
  const matrix = cloneMatrix(PIECES[type]);
  return {
    type,
    matrix,
    x: Math.floor((width - matrix[0].length) / 2),
    y: -1
  };
}
