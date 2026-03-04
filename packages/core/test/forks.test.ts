import { describe, it, expect } from "vitest";
import { detectForks } from "../src";
import { positionAfterMoves } from "./support/chessPosition";

/**
 * We pick a known line where a fork is undeniably present:
 * After Nxf7, the knight on f7 attacks BOTH:
 * - black queen on d8
 * - black rook on h8
 * (and we ignore pawns by default).
 */
describe("detectForks", () => {
  it("finds a knight fork hitting queen + rook (minor+ targets)", () => {
    // Arrange
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

    // Act
    const motifs = detectForks(fen, "w").filter((m) => m.type === "fork");

    // Assert
    const fork = motifs.find((m) => {
      if (m.type !== "fork") return false;
      if (m.attacker.square !== "f7") return false;

      const targetSquares = new Set(m.targets.map((t) => t.square));
      return targetSquares.has("d8") && targetSquares.has("h8");
    });

    expect(fork, "expected fork from f7 onto d8 + h8").toBeTruthy();
  });
});
