// packages/core/test/forks.test.ts
import { describe, it, expect } from "vitest";
import { detectForks } from "../src";
import { positionAfterMoves } from "./support/chessPosition";

function findFork(
  fen: string,
  attacker: "w" | "b",
  attackerSquare: string,
  requiredTargets: string[],
) {
  const motifs = detectForks(fen, attacker).filter((m) => m.type === "fork");
  return motifs.find((m) => {
    if (m.type !== "fork") return false;
    if (m.attacker.square !== attackerSquare) return false;

    const targetSquares = new Set(m.targets.map((t) => t.square));
    return requiredTargets.every((sq) => targetSquares.has(sq));
  });
}

describe("detectForks", () => {
  it("finds a knight fork hitting queen + rook (minor+ targets) via real moves", () => {
    const chess = positionAfterMoves([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bc4",
      "Nf6",
      "Ng5",
      "d5",
      "exd5",
      "Nxd5",
      "Nxf7",
    ]);
    const fen = chess.fen();

    const fork = findFork(fen, "w", "f7", ["d8", "h8"]);
    expect(fork, "expected fork from f7 onto d8 + h8").toBeTruthy();
  });

  it("finds a knight fork hitting king + queen (king always counts)", () => {
    // White knight on d6 attacks black king e8 and queen f7.
    // Side to move is black to keep the FEN legal (black is in check).
    const fen = "4k3/5q2/3N4/8/8/8/8/7K b - - 0 1";

    const fork = findFork(fen, "w", "d6", ["e8", "f7"]);
    expect(fork, "expected fork from d6 onto e8 + f7").toBeTruthy();
  });

  it("finds a queen fork hitting two rooks in different directions", () => {
    // White queen d6 attacks rook d8 (file) and rook h6 (rank)
    const fen = "3rk3/8/3Q3r/8/8/8/8/7K w - - 0 1";

    const fork = findFork(fen, "w", "d6", ["d8", "h6"]);
    expect(fork, "expected queen fork from d6 onto d8 + h6").toBeTruthy();
  });

  it("finds a bishop fork hitting queen + rook (two diagonals)", () => {
    // Bishop c4 attacks rook b5 and queen f7
    const fen = "4k3/5q2/8/1r6/2B5/8/8/7K w - - 0 1";

    const fork = findFork(fen, "w", "c4", ["b5", "f7"]);
    expect(fork, "expected bishop fork from c4 onto b5 + f7").toBeTruthy();
  });

  it("finds a pawn fork hitting two minor pieces (pawn is valid attacker)", () => {
    // White pawn e5 attacks d6 and f6. Both are minor pieces -> should count.
    const fen = "k7/8/3n1b2/4P3/8/8/8/7K w - - 0 1";

    const fork = findFork(fen, "w", "e5", ["d6", "f6"]);
    expect(fork, "expected pawn fork from e5 onto d6 + f6").toBeTruthy();
  });

  it("finds a black fork too (attacker color coverage)", () => {
    // Black knight e4 attacks white queen d2 and rook f2
    const fen = "4k3/8/8/8/4n3/8/3Q1R2/4K3 w - - 0 1";

    const fork = findFork(fen, "b", "e4", ["d2", "f2"]);
    expect(
      fork,
      "expected black knight fork from e4 onto d2 + f2",
    ).toBeTruthy();
  });

  it("does NOT count a 'fork' when only one target is minor+ and the other is a pawn (pawn target ignored)", () => {
    // White knight f5 attacks g7 (bishop) + h6 (pawn). Only bishop counts => not a fork.
    const fen = "4k3/6b1/7p/5N2/8/8/8/7K w - - 0 1";

    const motifs = detectForks(fen, "w").filter((m) => m.type === "fork");
    const hasForkFromF5 = motifs.some(
      (m) => m.type === "fork" && m.attacker.square === "f5",
    );

    expect(
      hasForkFromF5,
      "expected no fork because pawn target doesn't count",
    ).toBe(false);
  });
});
