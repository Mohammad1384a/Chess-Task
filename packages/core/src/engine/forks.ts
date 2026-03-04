import { Chess, type Square } from "chess.js";
import type { Color, Motif } from "../index.js";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type Coord = { x: number; y: number }; // x: 0..7 (a..h), y: 0..7 (1..8)

const FILES = "abcdefgh";

const PIECE_VALUE: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

function allSquares(): Square[] {
  const squares: Square[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let f = 0; f < 8; f++) {
      squares.push(`${FILES[f]}${rank}` as Square);
    }
  }
  return squares;
}

function squareToCoord(square: Square): Coord {
  const x = FILES.indexOf(square[0]);
  const y = Number(square[1]) - 1;
  return { x, y };
}

function coordToSquare(c: Coord): Square {
  return `${FILES[c.x]}${c.y + 1}` as Square;
}

function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < 8 && c.y >= 0 && c.y < 8;
}

function add(c: Coord, dx: number, dy: number): Coord {
  return { x: c.x + dx, y: c.y + dy };
}

function raySquares(
  chess: Chess,
  from: Square,
  dx: number,
  dy: number,
): Square[] {
  const res: Square[] = [];
  let cur = add(squareToCoord(from), dx, dy);

  while (inBounds(cur)) {
    const sq = coordToSquare(cur);
    res.push(sq);

    // stop ray at first blocker (piece on the square)
    if (chess.get(sq)) break;

    cur = add(cur, dx, dy);
  }
  return res;
}

function attackedSquares(
  chess: Chess,
  from: Square,
  piece: PieceType,
  color: Color,
): Square[] {
  const fromC = squareToCoord(from);

  if (piece === "n") {
    const deltas: Array<[number, number]> = [
      [1, 2],
      [2, 1],
      [2, -1],
      [1, -2],
      [-1, -2],
      [-2, -1],
      [-2, 1],
      [-1, 2],
    ];
    return deltas
      .map(([dx, dy]) => add(fromC, dx, dy))
      .filter(inBounds)
      .map(coordToSquare);
  }

  if (piece === "k") {
    const deltas: Array<[number, number]> = [
      [1, 1],
      [1, 0],
      [1, -1],
      [0, 1],
      [0, -1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
    ];
    return deltas
      .map(([dx, dy]) => add(fromC, dx, dy))
      .filter(inBounds)
      .map(coordToSquare);
  }

  if (piece === "p") {
    const dy = color === "w" ? 1 : -1;
    const candidates = [add(fromC, 1, dy), add(fromC, -1, dy)];
    return candidates.filter(inBounds).map(coordToSquare);
  }

  if (piece === "b" || piece === "r" || piece === "q") {
    const diag: Array<[number, number]> = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const ortho: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    const dirs =
      piece === "b" ? diag : piece === "r" ? ortho : [...diag, ...ortho];

    return dirs.flatMap(([dx, dy]) => raySquares(chess, from, dx, dy));
  }

  return [];
}

function isForkTarget(piece: PieceType): boolean {
  // Keep signal high: count king always, otherwise minor+ (>=3)
  return piece === "k" || PIECE_VALUE[piece] >= 3;
}

export function detectForks(fen: string, attacker: Color): Motif[] {
  const chess = new Chess(fen);
  const motifs: Motif[] = [];

  for (const attackerSquare of allSquares()) {
    const attackerPiece = chess.get(attackerSquare);
    if (!attackerPiece) continue;
    if (attackerPiece.color !== attacker) continue;

    const attackerType = attackerPiece.type as PieceType;

    const attacks = attackedSquares(
      chess,
      attackerSquare,
      attackerType,
      attacker,
    );
    const targets: Array<{ square: string; piece: string; color: Color }> = [];

    for (const sq of attacks) {
      const victim = chess.get(sq);
      if (!victim) continue;
      if (victim.color === attacker) continue;

      const victimType = victim.type as PieceType;
      if (!isForkTarget(victimType)) continue;

      targets.push({ square: sq, piece: victim.type, color: victim.color });
    }

    if (targets.length >= 2) {
      motifs.push({
        type: "fork",
        attacker: {
          square: attackerSquare,
          piece: attackerPiece.type,
          color: attacker,
        },
        targets,
      });
    }
  }

  return motifs;
}
