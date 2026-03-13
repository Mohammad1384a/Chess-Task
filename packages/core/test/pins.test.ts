import { describe, it, expect } from "vitest";
import { detectPins } from "../src";
import { positionAfterMoves } from "./support/chessPosition";

type PinKind = "absolute" | "relative";

function findPin(
  fen: string,
  attacker: "w" | "b",
  attackerSquare: string,
  pinnedSquare: string,
  behindSquare: string,
  kind?: PinKind,
) {
  const motifs = detectPins(fen, attacker).filter((m) => m.type === "pin");
  return motifs.find((m) => {
    if (m.type !== "pin") return false;
    if (kind && m.kind !== kind) return false;

    return (
      m.attacker.square === attackerSquare &&
      m.pinned.square === pinnedSquare &&
      m.behind.square === behindSquare
    );
  });
}

//https://lichess.org/editor/r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/5N2/PPPP1PPP/RNBQK2R_w_KQkq_-_0_1?color=white&position=518
describe("detectPins (absolute to king + relative to queen, with practical invalidations)", () => {
  it("bishop diagonal absolute pin (opening example)", () => {
    // After: 1.e4 e5 2.Nf3 Nc6 3.Bb5 d6
    // bishop b5 pins knight c6 to king e8 along b5-c6-d7-e8
    const chess = positionAfterMoves(["e4", "e5", "Nf3", "Nc6", "Bb5", "d6"]);
    const fen = chess.fen();

    const pin = findPin(fen, "w", "b5", "c6", "e8", "absolute");
    expect(pin, "expected bishop b5 pinning c6 to king e8").toBeTruthy();
  });

  //https://lichess.org/editor/4k3/4n3/8/8/8/8/8/4R2K_w_-_-_0_1?color=white&position=518
  it("rook file absolute pin (pinned piece = knight)", () => {
    // White rook e1 pins black knight e7 to black king e8
    const fen = "4k3/4n3/8/8/8/8/8/4R2K w - - 0 1";

    const pin = findPin(fen, "w", "e1", "e7", "e8", "absolute");
    expect(pin, "expected rook e1 pinning e7 to king e8").toBeTruthy();
  });

  //https://lichess.org/editor/8/3k4/2p5/8/Q7/8/8/7K_w_-_-_0_1?color=white&position=518
  it("queen diagonal absolute pin (pinned piece = pawn)", () => {
    // White queen a4 pins black pawn c6 to black king d7 along a4-b5-c6-d7
    const fen = "8/3k4/2p5/8/Q7/8/8/7K w - - 0 1";

    const pin = findPin(fen, "w", "a4", "c6", "d7", "absolute");
    expect(pin, "expected queen a4 pinning c6 to king d7").toBeTruthy();
  });

  //https://lichess.org/editor/8/3k4/2p5/8/Q7/8/8/7K_w_-_-_0_1?color=white&position=518
  it("detects a relative pin to the queen (pins are considered to king OR queen only)", () => {
    // White bishop b5 pins black knight c6 to black queen d7 along b5-c6-d7
    const fen = "4k3/3q4/2n5/1B6/8/8/8/7K w - - 0 1";

    const pin = findPin(fen, "w", "b5", "c6", "d7", "relative");
    expect(pin, "expected relative pin b5 -> c6 -> d7 (queen)").toBeTruthy();
  });

  //https://lichess.org/editor/r6k/b7/8/8/8/8/8/R6K_w_-_-_0_1?color=white&position=518
  it("does NOT count a pin when the behind piece is NOT king/queen (pinning to rook is not a pin)", () => {
    // White rook a1 attacks black bishop a7 with black rook a8 behind it => geometrically a 'pin to rook',
    // but by our rule only king/queen pins are counted.
    const fen = "r6k/b7/8/8/8/8/8/R6K w - - 0 1";

    const motifs = detectPins(fen, "w").filter((m) => m.type === "pin");
    const pinToRook = motifs.find(
      (m) =>
        m.type === "pin" &&
        m.attacker.square === "a1" &&
        m.pinned.square === "a7" &&
        m.behind.square === "a8",
    );

    expect(pinToRook, "expected no pin when pinning to rook").toBeFalsy();
  });

  //https://lichess.org/editor/8/8/2k5/1q6/B7/1P6/8/7K_w_-_-_0_1?color=white&position=518
  it("bishop pins a queen to the king: if the bishop is protected, it IS a pin (queen capture loses material)", () => {
    // a4 bishop pins b5 queen to c6 king (a4-b5-c6).
    // Bishop is protected by pawn b3. Qxa4 is legal but loses the queen to bxa4, so we still call it a pin.
    const fen = "8/8/2k5/1q6/B7/1P6/8/7K w - - 0 1";

    const pin = findPin(fen, "w", "a4", "b5", "c6", "absolute");
    expect(
      pin,
      "expected pin because bishop is protected (queen can't take profitably)",
    ).toBeTruthy();
  });

  //https://lichess.org/editor/8/8/2k5/1q6/B7/8/8/7K_w_-_-_0_1?color=white&position=518
  it("bishop pins a queen to the king: if the bishop is NOT protected, it is NOT a pin (queen can take)", () => {
    // Same as previous position but bishop is unprotected => Qxa4 is a clean escape, so we don't call it a pin.
    const fen = "8/8/2k5/1q6/B7/8/8/7K w - - 0 1";

    const pin = findPin(fen, "w", "a4", "b5", "c6", "absolute");
    expect(
      pin,
      "expected NO pin because queen can capture the unprotected bishop",
    ).toBeFalsy();
  });

  //https://lichess.org/editor/r4r2/ppp1k1p1/2n2nBp/3pqP2/6PP/2P1QP2/PP6/RN2K2R_w_KQ_-_0_20?color=white&position=518
  it("does NOT count a pin when the pinned piece can legally capture the pinning piece (example from recruiter)", () => {
    // In this position, black queen e5 geometrically pins white queen e3 to white king e1,
    // but Qxe5 is a legal capture and is not losing (queen trade), so we do NOT call it a pin.
    const fen = "r4r2/ppp1k1p1/2n2nBp/3pqP2/6PP/2P1QP2/PP6/RN2K2R w KQ - 0 20";

    const wouldBePin = findPin(fen, "b", "e5", "e3", "e1", "absolute");
    expect(
      wouldBePin,
      "expected NO pin because pinned queen can legally capture attacker",
    ).toBeFalsy();
  });

  //https://lichess.org/editor/k3r3/8/8/4q3/3B4/2K5/8/8_b_-_-_0_1?color=white&position=518
  it("if pinner is higher value than the pinned piece: capture invalidates the pin even if pinner is protected (queen pins bishop)", () => {
    // Black queen e5 pins white bishop d4 to white king c3 (e5-d4-c3).
    // Bishop can legally capture Qe5, and even if the queen is protected by rook e8,
    // the trade wins material for the pinned side -> not a practical pin.
    const fen = "k3r3/8/8/4q3/3B4/2K5/8/8 b - - 0 1";

    const wouldBePin = findPin(fen, "b", "e5", "d4", "c3", "absolute");
    expect(
      wouldBePin,
      "expected NO pin because pinned bishop can capture higher-value attacker (even if protected)",
    ).toBeFalsy();
  });

  //https://lichess.org/editor/4q3/4k3/8/8/8/8/8/4R2K_w_-_-_0_1?color=white&position=518
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

  //https://lichess.org/editor/r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R_w_KQkq_-_0_1?color=white&position=518
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
