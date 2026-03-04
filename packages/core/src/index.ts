// packages/core/src/index.ts
export type Color = "w" | "b";

export type Motif =
  | {
      type: "fork";
      attacker: { square: string; piece: string; color: Color };
      targets: Array<{ square: string; piece: string; color: Color }>;
    }
  | {
      type: "pin";
      kind: "absolute" | "relative";
      attacker: { square: string; piece: string; color: Color };
      pinned: { square: string; piece: string; color: Color };
      behind: { square: string; piece: string; color: Color };
    };

export type Occurrence = {
  gameIndex: number;
  ply: number; // 1-based half-move index
  san: string;
  fen: string; // after-position
  motif: Motif;
};

export type AnalysisResult = { occurrences: Occurrence[] };

export function detectForks(_fen: string, _attacker: Color): Motif[] {
  return [];
}

export function detectPins(_fen: string, _attacker: Color): Motif[] {
  return [];
}

/**
 * Must parse multi-game PGN.
 * Must emit only motifs that are CREATED (after - before) per ply.
 */
export function analyzePgn(_pgn: string): AnalysisResult {
  return { occurrences: [] };
}
