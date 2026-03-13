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

function opponent(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function fenWithTurn(fen: string, turn: Color): string {
  const parts = fen.split(" ");
  if (parts.length < 2) return fen;
  parts[1] = turn;
  return parts.join(" ");
}

function allSquares(): Square[] {
  const squares: Square[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${rank}` as Square);
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

    // stop ray at first blocker
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
    return [add(fromC, 1, dy), add(fromC, -1, dy)]
      .filter(inBounds)
      .map(coordToSquare);
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
  // keep signal high: king always, otherwise minor+
  return piece === "k" || PIECE_VALUE[piece] >= 3;
}

/**
 * Geometric "defended" (not legality-filtered):
 * A square is defended if any piece of defenderColor attacks that square geometrically.
 * This is intentionally geometric (as players talk about "defended") and matches the task’s practical heuristics.
 */
function isSquareDefended(
  chess: Chess,
  defenderColor: Color,
  sq: Square,
): boolean {
  for (const from of allSquares()) {
    const p = chess.get(from);
    if (!p) continue;
    if (p.color !== defenderColor) continue;

    const pt = p.type as PieceType;
    const attacks = attackedSquares(chess, from, pt, defenderColor);
    if (attacks.includes(sq)) return true;
  }
  return false;
}

/**
 * Legal capture check:
 * Returns true if capturerColor has ANY legal move capturing the piece on `toSquare`.
 * (Used to invalidate forks where the attacker can be taken immediately.)
 */
function canColorLegallyCaptureSquare(
  chess: Chess,
  capturerColor: Color,
  toSquare: Square,
): boolean {
  const sim = new Chess(fenWithTurn(chess.fen(), capturerColor));
  const moves = sim.moves({ verbose: true }) as any[];
  return moves.some((m) => m.to === toSquare && m.captured);
}

/**
 * Legal capture availability from attackerSquare to targetSquare (pin / king safety aware).
 */
function attackerCanLegallyCapture(
  chess: Chess,
  attackerColor: Color,
  attackerSquare: Square,
  targetSquare: Square,
): boolean {
  const sim = new Chess(fenWithTurn(chess.fen(), attackerColor));
  const moves = sim.moves({ verbose: true }) as any[];
  return moves.some(
    (m) => m.from === attackerSquare && m.to === targetSquare && m.captured,
  );
}

export function detectForks(fen: string, attacker: Color): Motif[] {
  const chess = new Chess(fen);
  const motifs: Motif[] = [];

  const defender = opponent(attacker);

  for (const attackerSquare of allSquares()) {
    const attackerPiece = chess.get(attackerSquare);
    if (!attackerPiece) continue;
    if (attackerPiece.color !== attacker) continue;

    const attackerType = attackerPiece.type as PieceType;
    const attackerValue = PIECE_VALUE[attackerType];

    // If the attacker can be captured immediately by the opponent, we don't consider it a practical fork.
    // (Covers: Nxf7 where Kxf7; queen "fork" on rooks where rook captures queen; bishop "fork" where queen takes bishop)
    if (canColorLegallyCaptureSquare(chess, defender, attackerSquare)) {
      continue;
    }

    // Geometric attacks for identifying candidate targets
    const attacks = attackedSquares(
      chess,
      attackerSquare,
      attackerType,
      attacker,
    );

    // Collect targets that are both (a) attacked and (b) meaningful
    const rawTargets: Array<{
      square: Square;
      piece: PieceType;
      color: Color;
    }> = [];
    for (const sq of attacks) {
      const victim = chess.get(sq);
      if (!victim) continue;
      if (victim.color === attacker) continue;

      const victimType = victim.type as PieceType;
      if (!isForkTarget(victimType)) continue;

      rawTargets.push({ square: sq, piece: victimType, color: victim.color });
    }

    if (rawTargets.length < 2) continue;

    // Enforce legality for non-king targets: attacker must be able to legally capture them.
    // (Pinned attacker / illegal captures => fork invalid)
    const targets = rawTargets.filter((t) => {
      if (t.piece === "k") return true; // can't capture king, still a "check target"
      return attackerCanLegallyCapture(
        chess,
        attacker,
        attackerSquare,
        t.square,
      );
    });

    if (targets.length < 2) continue;

    // Practical material rule:
    // For each non-king target:
    // - if hanging => OK
    // - if defended => must be higher value than attacker (wins material even if recaptured)
    const nonKing = targets.filter((t) => t.piece !== "k");
    const hasKing = targets.some((t) => t.piece === "k");

    // If fork only "exists" because of king + one piece, require at least one non-king target
    if (hasKing && nonKing.length === 0) continue;

    // Apply defended/hanging/value constraints
    let hasHangingNonKing = false;
    let allNonKingOk = true;

    for (const t of nonKing) {
      const defended = isSquareDefended(chess, t.color, t.square);
      const hanging = !defended;
      if (hanging) {
        hasHangingNonKing = true;
        continue;
      }

      const tVal = PIECE_VALUE[t.piece];
      if (tVal <= attackerValue) {
        allNonKingOk = false;
        break;
      }
    }

    if (!allNonKingOk) continue;

    // "At least one target hanging" OR (if none hanging, then all defended targets must be > attacker)
    // This is already ensured by allNonKingOk; this check mainly enforces the "hanging" clause.
    // If none are hanging, we still allow it (e.g., knight forks defended rook+queen).
    // So we do not reject when !hasHangingNonKing.

    // Additional check-related practical constraint (covers recruiter examples):
    // If the only material target is low-value (<= attacker) OR defended and easily saved, it won't pass above anyway.
    // Here, we specifically suppress check+defended-low-value "forks" because they don't win material.
    if (hasKing && nonKing.length === 1) {
      const t = nonKing[0];
      const defended = isSquareDefended(chess, t.color, t.square);
      const tVal = PIECE_VALUE[t.piece];

      if (defended && tVal <= attackerValue) {
        continue;
      }
    }

    // Build motif targets payload
    const motifTargets = targets.map((t) => ({
      square: t.square,
      piece: t.piece,
      color: t.color,
    }));

    if (motifTargets.length >= 2) {
      motifs.push({
        type: "fork",
        attacker: {
          square: attackerSquare,
          piece: attackerPiece.type,
          color: attacker,
        },
        targets: motifTargets,
      });
    }
  }

  return motifs;
}
