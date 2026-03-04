import { describe, it, expect } from "vitest";
import { detectPins } from "../src";
import { positionAfterMoves } from "./support/chessPosition";

function findAbsolutePin(
  fen: string,
  attacker: "w" | "b",
  attackerSquare: string,
  pinnedSquare: string,
  kingSquare: string,
) {
  const motifs = detectPins(fen, attacker).filter((m) => m.type === "pin");
  return motifs.find((m) => {
    if (m.type !== "pin") return false;
    return (
      m.kind === "absolute" &&
      m.attacker.square === attackerSquare &&
      m.pinned.square === pinnedSquare &&
      m.behind.square === kingSquare
    );
  });
}

describe("detectPins (absolute)", () => {
  it("bishop diagonal absolute pin (opening example)", () => {
    // After: 1.e4 e5 2.Nf3 Nc6 3.Bb5 d6
    // bishop b5 pins knight c6 to king e8 along b5-c6-d7-e8
    const chess = positionAfterMoves(["e4", "e5", "Nf3", "Nc6", "Bb5", "d6"]);
    const fen = chess.fen();

    const pin = findAbsolutePin(fen, "w", "b5", "c6", "e8");
    expect(pin, "expected bishop b5 pinning c6 to king e8").toBeTruthy();
  });

  it("rook file absolute pin (pinned piece = knight)", () => {
    // White rook e1 pins black knight e7 to black king e8
    const fen = "4k3/4n3/8/8/8/8/8/4R2K w - - 0 1";

    const pin = findAbsolutePin(fen, "w", "e1", "e7", "e8");
    expect(pin, "expected rook e1 pinning e7 to king e8").toBeTruthy();
  });

  it("rook rank absolute pin (pinned piece = bishop)", () => {
    // White rook a1 pins black bishop d1 to black king e1 along a1-b1-c1-d1-e1
    const fen = "8/8/8/8/8/8/8/R2bk2K w - - 0 1";

    const pin = findAbsolutePin(fen, "w", "a1", "d1", "e1");
    expect(pin, "expected rook a1 pinning d1 to king e1").toBeTruthy();
  });

  it("queen diagonal absolute pin (pinned piece = pawn)", () => {
    // White queen a4 pins black pawn c6 to black king d7 along a4-b5-c6-d7
    const fen = "8/3k4/2p5/8/Q7/8/8/7K w - - 0 1";

    const pin = findAbsolutePin(fen, "w", "a4", "c6", "d7");
    expect(pin, "expected queen a4 pinning c6 to king d7").toBeTruthy();
  });

  it("rook file absolute pin (pinned piece = queen)", () => {
    // White rook e1 pins black queen e7 to black king e8
    const fen = "4k3/4q3/8/8/8/8/8/4R2K w - - 0 1";

    const pin = findAbsolutePin(fen, "w", "e1", "e7", "e8");
    expect(pin, "expected rook e1 pinning queen e7 to king e8").toBeTruthy();
  });

  it("does NOT report a pin when the 'pinned' piece would be the king (king can't be pinned)", () => {
    // Rook e1 attacks e7 (king) first, with queen behind on e8.
    // This must NOT be reported as a pin because the pinned piece is the king.
    const fen = "4q3/4k3/8/8/8/8/8/4R2K w - - 0 1";

    const motifs = detectPins(fen, "w").filter((m) => m.type === "pin");
    const illegalPin = motifs.find(
      (m) => m.type === "pin" && m.pinned.square === "e7",
    );

    expect(
      illegalPin,
      "expected no pin where king is the pinned piece",
    ).toBeFalsy();
  });

  it("does NOT report a pin when line is blocked before the king", () => {
    // After: 1.e4 e5 2.Nf3 Nc6 3.Bb5
    // bishop b5 sees c6 (knight) then d7 (pawn) blocks -> no absolute pin to e8.
    const chess = positionAfterMoves(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    const fen = chess.fen();

    const motifs = detectPins(fen, "w").filter((m) => m.type === "pin");
    const falsePin = motifs.find(
      (m) =>
        m.type === "pin" &&
        m.attacker.square === "b5" &&
        m.pinned.square === "c6" &&
        m.behind.square === "e8",
    );

    expect(falsePin, "expected no pin because d7 blocks the line").toBeFalsy();
  });
});
