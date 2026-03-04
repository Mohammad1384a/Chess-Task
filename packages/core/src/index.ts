export { detectPins } from "./engine/pins";
export { detectForks } from "./engine/forks";
export { analyzePgn } from "./application/analyzePgn";
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
