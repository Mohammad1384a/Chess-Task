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

function hasFork(
  fen: string,
  attacker: "w" | "b",
  attackerSquare: string,
  requiredTargets: string[],
) {
  return Boolean(findFork(fen, attacker, attackerSquare, requiredTargets));
}

//https://lichess.org/editor/r1bqkb1r/ppp2Npp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R_w_KQkq_-_0_1?color=white&position=518
describe("detectForks (practical)", () => {
  it("does NOT count the Nxf7 'fork' because the king can capture the knight (no material gain)", () => {
    // This is the classic sequence that geometrically looks like a fork (N on f7 hits Qd8 + Rh8),
    // but in this exact position the bishop c4->f7 diagonal is blocked (pawn on d5),
    // so Kxf7 is available and the fork doesn't win material.
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
    expect(
      fork,
      "expected NOT a fork because king can capture attacker",
    ).toBeFalsy();
  });

  //https://lichess.org/editor/4k3/8/8/8/4n3/8/3Q1R2/4K3_w_-_-_0_1?color=white&position=518
  it("counts a practical fork when both targets are higher value than attacker (black knight forks queen + rook)", () => {
    // Black knight e4 attacks white queen d2 and rook f2.
    // Both are higher value than the knight; opponent cannot save both in one move.
    const fen = "4k3/8/8/8/4n3/8/3Q1R2/4K3 w - - 0 1";

    const fork = findFork(fen, "b", "e4", ["d2", "f2"]);
    expect(
      fork,
      "expected practical black fork from e4 onto d2 + f2",
    ).toBeTruthy();
  });

  //https://lichess.org/editor/4k3/6b1/7p/5N2/8/8/8/7K_w_-_-_0_1?color=white&position=518
  it("does NOT count a 'fork' when only one meaningful target exists (pawn targets ignored)", () => {
    // White knight f5 attacks g7 (bishop) + h6 (pawn). Pawn target ignored => not a fork.
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

  //https://lichess.org/editor/k3r3/8/8/8/5q2/2r5/4N3/4K3_w_-_-_0_1?color=white&position=518
  it("does NOT count a fork if the attacker is pinned and cannot legally capture (moves must be legal)", () => {
    // White knight e2 attacks black rook c3 and black queen f4,
    // but the knight is pinned to king e1 by rook e8 => cannot move/capture legally.
    const fen = "k3r3/8/8/8/5q2/2r5/4N3/4K3 w - - 0 1";

    const isCounted = hasFork(fen, "w", "e2", ["c3", "f4"]);
    expect(isCounted, "expected NOT a fork because attacker is pinned").toBe(
      false,
    );
  });

  //https://lichess.org/editor/3rk3/8/3Q3r/8/8/8/8/7K_w_-_-_0_1?color=white&position=518
  it("does NOT count a queen 'fork' on two rooks when the queen can be captured / does not win material", () => {
    // White queen d6 attacks rooks d8 and h6, but either rook can capture the queen (Rxd6 / Rxd6),
    // so there is no material gain and it's not a practical fork.
    const fen = "3rk3/8/3Q3r/8/8/8/8/7K w - - 0 1";

    const fork = findFork(fen, "w", "d6", ["d8", "h6"]);
    expect(
      fork,
      "expected NOT a fork because queen is easily captured",
    ).toBeFalsy();
  });

  //https://lichess.org/editor/4k3/5q2/8/1r6/2B5/8/8/7K_w_-_-_0_1?color=white&position=518
  it("does NOT count a bishop 'fork' when the queen can capture the bishop (no real material gain)", () => {
    // Bishop c4 attacks rook b5 and queen f7, but Qxc4 is immediately available,
    // so the threat does not win material in practice.
    const fen = "4k3/5q2/8/1r6/2B5/8/8/7K w - - 0 1";

    const fork = findFork(fen, "w", "c4", ["b5", "f7"]);
    expect(
      fork,
      "expected NOT a fork because queen can capture the bishop",
    ).toBeFalsy();
  });

  //https://lichess.org/editor/r4r2/p1p1k1p1/5nBp/1p1p1P2/2n3PP/2P1KP2/P2N4/1R5R_w_-_-_2_25?color=white&position=518
  it("does NOT count as a fork if king can simply move and defend the forked piece (recruiter example 1)", () => {
    const fen = "r4r2/p1p1k1p1/5nBp/1p1p1P2/2n3PP/2P1KP2/P2N4/1R5R w - - 2 25";

    const isCounted = hasFork(fen, "b", "c4", ["e3", "d2"]);
    expect(isCounted, "expected NOT a fork by practical definition").toBe(
      false,
    );
  });

  //https://lichess.org/editor/r4r2/ppp1k1p1/2n2nBp/3pQP2/6PP/2P2P2/PP6/RN2K2R_b_KQ_-_0_20?color=white&position=518
  it("does NOT count as a fork when the non-king target is protected and easily defended (recruiter example 2)", () => {
    const fen = "r4r2/ppp1k1p1/2n2nBp/3pQP2/6PP/2P2P2/PP6/RN2K2R b KQ - 0 20";

    const isCounted = hasFork(fen, "w", "e5", ["e7", "f6"]);
    expect(isCounted, "expected NOT a fork by practical definition").toBe(
      false,
    );
  });
});
