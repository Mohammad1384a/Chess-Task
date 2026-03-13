import { Chess } from "chess.js";
import { detectForks } from "../engine/forks.js";
import { detectPins } from "../engine/pins.js";
import type { AnalysisResult, Color, Motif, Occurrence } from "../index.js";

function normalizePgn(pgn: string): string {
  return pgn.replace(/\r\n/g, "\n").trim();
}

function splitMultiGamePgn(pgn: string): string[] {
  const text = normalizePgn(pgn);
  if (!text) return [];

  const eventMatches = Array.from(text.matchAll(/^\[Event\b.*$/gm));
  if (eventMatches.length >= 2) {
    const starts = eventMatches
      .map((m) => m.index ?? 0)
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);

    const games: string[] = [];
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const end = i + 1 < starts.length ? starts[i + 1] : text.length;
      const chunk = text.slice(start, end).trim();
      if (chunk) games.push(chunk);
    }
    return games;
  }

  return [text];
}

function extractStartFen(gamePgn: string): string | null {
  // chess.js supports PGN tags [SetUp "1"] and [FEN "..."] for non-standard initial positions.
  const fenMatch = gamePgn.match(/^\[FEN\s+"([^"]+)"\]\s*$/im);
  if (!fenMatch) return null;
  return fenMatch[1];
}

function motifSignature(m: Motif): string {
  if (m.type === "fork") {
    const targets = [...m.targets]
      .map((t) => `${t.square}:${t.piece}`)
      .sort()
      .join(",");
    return `fork|${m.attacker.color}|${m.attacker.square}:${m.attacker.piece}|${targets}`;
  }

  return `pin|${m.kind}|${m.attacker.color}|${m.attacker.square}:${m.attacker.piece}|${m.pinned.square}:${m.pinned.piece}|${m.behind.square}:${m.behind.piece}`;
}

function motifsInPosition(fen: string, attacker: Color): Motif[] {
  return [...detectForks(fen, attacker), ...detectPins(fen, attacker)];
}

function createdMotifs(
  beforeFen: string,
  afterFen: string,
  attacker: Color,
): Motif[] {
  const before = motifsInPosition(beforeFen, attacker);
  const after = motifsInPosition(afterFen, attacker);

  const beforeSet = new Set(before.map(motifSignature));
  return after.filter((m) => !beforeSet.has(motifSignature(m)));
}

function analyzeSingleGame(gamePgn: string, gameIndex: number): Occurrence[] {
  const loader = new Chess();
  try {
    loader.loadPgn(gamePgn);
  } catch (e) {
    throw new Error(
      `Invalid PGN for gameIndex=${gameIndex}: ${(e as Error).message}`,
    );
  }

  const sanMoves = loader.history(); // SAN list from the PGN's starting position
  if (sanMoves.length === 0) {
    throw new Error(`Invalid/empty PGN for gameIndex=${gameIndex}`);
  }

  // IMPORTANT: replay must start from the PGN’s declared FEN (if any)
  const startFen = extractStartFen(gamePgn);
  const replay = startFen ? new Chess(startFen) : new Chess();

  const occurrences: Occurrence[] = [];

  for (let i = 0; i < sanMoves.length; i++) {
    const ply = i + 1;
    const beforeFen = replay.fen();

    const res = replay.move(sanMoves[i]);
    if (!res) {
      throw new Error(
        `Illegal move while replaying gameIndex=${gameIndex}, ply=${ply}`,
      );
    }

    const afterFen = replay.fen();
    const san = res.san;

    const colors: Color[] = ["w", "b"];
    for (const attacker of colors) {
      const created = createdMotifs(beforeFen, afterFen, attacker);
      for (const motif of created) {
        occurrences.push({
          gameIndex,
          ply,
          san,
          fen: afterFen,
          motif,
        });
      }
    }
  }

  return occurrences;
}

export function analyzePgn(pgn: string): AnalysisResult {
  const games = splitMultiGamePgn(pgn);

  const occurrences: Occurrence[] = [];
  for (let i = 0; i < games.length; i++) {
    occurrences.push(...analyzeSingleGame(games[i], i));
  }

  return { occurrences };
}
