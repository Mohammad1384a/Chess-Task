import { Chess } from "chess.js";

export function positionAfterMoves(moves: string[]) {
  const chess = new Chess();
  for (const move of moves) {
    const res = chess.move(move);
    if (!res) throw new Error(`Illegal move in test fixture: ${move}`);
  }
  return chess;
}
