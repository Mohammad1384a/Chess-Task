import { describe, it, expect } from "vitest";
import { detectPins } from "../src";
import { positionAfterMoves } from "./support/chessPosition";

/**
 * After: 1.e4 e5 2.Nf3 Nc6 3.Bb5 d6
 * The pawn leaving d7 makes bishop b5 pin knight c6 to king e8 (absolute pin).
 */
describe("detectPins", () => {
  it("finds an absolute bishop pin created by unblocking d7", () => {
    // Arrange
    const chess = positionAfterMoves(["e4", "e5", "Nf3", "Nc6", "Bb5", "d6"]);
    const fen = chess.fen();

    // Act
    const motifs = detectPins(fen, "w").filter((m) => m.type === "pin");

    // Assert
    const pin = motifs.find((m) => {
      if (m.type !== "pin") return false;
      return (
        m.kind === "absolute" &&
        m.attacker.square === "b5" &&
        m.pinned.square === "c6" &&
        m.behind.square === "e8"
      );
    });

    expect(pin, "expected bishop b5 pinning c6 to king e8").toBeTruthy();
  });
});
