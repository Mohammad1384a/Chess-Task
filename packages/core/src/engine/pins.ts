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

function allSquares(): Square[] {
  const squares: Square[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${rank}` as Square);
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

function fenWithTurn(fen: string, turn: Color): string {
  const parts = fen.split(" ");
  if (parts.length < 2) return fen;
  parts[1] = turn;
  return parts.join(" ");
}

/**
 * Practical invalidation:
 * If the pinned piece can legally capture the pinner AND that capture is not losing material,
 * we do NOT call it a pin.
 *
 * We approximate "not losing" as:
 * - If attacker side cannot recapture on the capture square -> capture wins -> invalidates pin
 * - Else net = value(attackerPiece) - value(pinnedPiece)
 *     net >= 0  => equal or winning trade for pinned side -> invalidates pin
 *     net < 0   => capturing loses material -> pin stands
 */
function captureInvalidatesPin(
  original: Chess,
  pinnedSquare: Square,
  attackerSquare: Square,
  attackerColor: Color,
): boolean {
  const pinnedPiece = original.get(pinnedSquare);
  const attackerPiece = original.get(attackerSquare);
  if (!pinnedPiece || !attackerPiece) return false;

  // Sanity: pinned piece must be the opponent of the attacker
  if (pinnedPiece.color === attackerColor) return false;

  // Important: check legality as if it's the pinned side to move (pins exist regardless of turn).
  const sim = new Chess(fenWithTurn(original.fen(), pinnedPiece.color));

  // Find a LEGAL capture move from pinnedSquare -> attackerSquare.
  const legalMoves = sim.moves({ verbose: true }) as any[];
  const captureMove = legalMoves.find(
    (m) => m.from === pinnedSquare && m.to === attackerSquare && m.captured,
  );

  if (!captureMove) return false; // cannot legally capture -> does not invalidate

  // Apply the legal capture (use SAN to avoid promotion/typing issues).
  sim.move(captureMove.san);

  // Now it should be attacker side to move; see if attacker can recapture on attackerSquare.
  const replies = sim.moves({ verbose: true }) as any[];
  const canRecapture = replies.some(
    (m) => m.to === attackerSquare && m.captured,
  );

  const pinnedValue = PIECE_VALUE[pinnedPiece.type as PieceType];
  const attackerValue = PIECE_VALUE[attackerPiece.type as PieceType];

  if (!canRecapture) {
    // Capturing wins the pinner outright -> not a pin
    return true;
  }

  const net = attackerValue - pinnedValue;
  // Equal trade or winning trade for pinned side -> not a pin
  return net >= 0;
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
          if (piece.color === attacker) break;

          // King cannot be pinned; if king is first blocker, stop scanning
          if (piece.type === "k") break;

          pinnedSquare = sq;
          pinnedPiece = piece;

          cur = add(cur, dx, dy);
          continue;
        }

        // Second blocker behind candidate: only king (absolute) or queen (relative) count
        if (
          piece.color !== attacker &&
          (piece.type === "k" || piece.type === "q")
        ) {
          const kind = piece.type === "k" ? "absolute" : "relative";

          // Practical invalidation: capture wins or trades equal/wins material => not a pin
          if (
            captureInvalidatesPin(chess, pinnedSquare, attackerSquare, attacker)
          ) {
            break;
          }

          motifs.push({
            type: "pin",
            kind,
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

        break;
      }
    }
  }

  return motifs;
}
