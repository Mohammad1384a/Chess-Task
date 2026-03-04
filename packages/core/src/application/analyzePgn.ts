import { Chess } from "chess.js";
import { detectForks } from "../engine/forks";
import { detectPins } from "../engine/pins";
import type { AnalysisResult, Color, Motif, Occurrence } from "../index";

function normalizePgn(pgn: string): string {
  return pgn.replace(/\r\n/g, "\n").trim();
}

function splitMultiGamePgn(pgn: string): string[] {
  const text = normalizePgn(pgn);
  if (!text) return [];

  // Prefer splitting by [Event ...] headers (standard multi-game PGN delimiter).
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

  // If there is only one [Event] or none, treat it as a single game.
  return [text];
}

function motifSignature(m: Motif): string {
  if (m.type === "fork") {
    const targets = [...m.targets]
      .map((t) => t.square)
      .sort()
      .join(",");
    return `fork|${m.attacker.color}|${m.attacker.square}|${targets}`;
  }

  // pin
  return `pin|${m.kind}|${m.attacker.color}|${m.attacker.square}|${m.pinned.square}|${m.behind.square}`;
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
  // Load once to get a clean list of moves, then replay for per-ply FENs.
  const loader = new Chess();
  try {
    loader.loadPgn(gamePgn);
  } catch (e) {
    throw new Error(
      `Invalid PGN for gameIndex=${gameIndex}: ${(e as Error).message}`,
    );
  }

  const verboseMoves = loader.history({ verbose: true }) as Array<{
    from: string;
    to: string;
    promotion?: string;
  }>;

  if (verboseMoves.length === 0) {
    // If you want to allow empty games, remove this.
    throw new Error(`Invalid/empty PGN for gameIndex=${gameIndex}`);
  }

  const moves = loader.history({ verbose: true }) as Array<{
    from: string;
    to: string;
    promotion?: string;
  }>;

  const replay = new Chess();
  const occurrences: Occurrence[] = [];

  for (let i = 0; i < moves.length; i++) {
    const ply = i + 1;
    const beforeFen = replay.fen();

    const m = moves[i];
    const res = replay.move({
      from: m.from as any,
      to: m.to as any,
      promotion: m.promotion as any,
    });

    if (!res)
      throw new Error(
        `Illegal move while replaying gameIndex=${gameIndex}, ply=${ply}`,
      );

    const afterFen = replay.fen();
    const san = res.san;

    // Product-y choice: a move can create a motif for either side,
    // so we diff both colors each ply.
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
