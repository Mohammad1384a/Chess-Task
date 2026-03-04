import { Chess, type Square } from "chess.js";
import type { Color, Motif } from "../index";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type Coord = { x: number; y: number }; // x: 0..7 (a..h), y: 0..7 (1..8)

const FILES = "abcdefgh";

function squareToCoord(square: Square): Coord {
  const x = FILES.indexOf(square[0]);
  const y = Number(square[1]) - 1;
  return { x, y };
}

function coordToSquare(c: Coord): Square {
  // Only called when in-bounds, so this is safe.
  return `${FILES[c.x]}${c.y + 1}` as Square;
}

function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < 8 && c.y >= 0 && c.y < 8;
}

function add(c: Coord, dx: number, dy: number): Coord {
  return { x: c.x + dx, y: c.y + dy };
}

function allSquares(): Square[] {
  const squares: Square[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let f = 0; f < 8; f++) {
      squares.push(`${FILES[f]}${rank}` as Square);
    }
  }
  return squares;
}

function directionsFor(piece: PieceType): Array<[number, number]> {
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

  if (piece === "b") return diag;
  if (piece === "r") return ortho;
  if (piece === "q") return [...diag, ...ortho];
  return [];
}

export function detectPins(fen: string, attacker: Color): Motif[] {
  const chess = new Chess(fen);
  const motifs: Motif[] = [];

  for (const attackerSquare of allSquares()) {
    const attackerPiece = chess.get(attackerSquare);
    if (!attackerPiece) continue;
    if (attackerPiece.color !== attacker) continue;

    const type = attackerPiece.type as PieceType;
    if (type !== "b" && type !== "r" && type !== "q") continue;

    const from = squareToCoord(attackerSquare);

    for (const [dx, dy] of directionsFor(type)) {
      let cur = add(from, dx, dy);

      let pinnedSquare: Square | null = null;
      let pinnedPiece: ReturnType<Chess["get"]> | null = null;

      while (inBounds(cur)) {
        const sq = coordToSquare(cur);
        const piece = chess.get(sq);

        if (!piece) {
          cur = add(cur, dx, dy);
          continue;
        }

        // First blocker on the ray
        if (!pinnedSquare) {
          // Friendly piece blocks; no pin possible in this direction
          if (piece.color === attacker) break;

          // Enemy piece becomes candidate pinned piece
          pinnedSquare = sq;
          pinnedPiece = piece;

          cur = add(cur, dx, dy);
          continue;
        }

        // Second blocker behind candidate
        if (piece.color !== attacker && piece.type === "k") {
          motifs.push({
            type: "pin",
            kind: "absolute",
            attacker: {
              square: attackerSquare,
              piece: attackerPiece.type,
              color: attacker,
            },
            pinned: {
              square: pinnedSquare,
              piece: pinnedPiece!.type,
              color: pinnedPiece!.color,
            },
            behind: { square: sq, piece: piece.type, color: piece.color },
          });
        }

        // Any second blocker ends this ray scan
        break;
      }
    }
  }

  return motifs;
}
