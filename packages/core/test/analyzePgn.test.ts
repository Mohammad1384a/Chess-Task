import { describe, it, expect } from "vitest";
import { analyzePgn } from "../src";

function isForkFromE6(o: any) {
  const targetSquares = new Set(o.motif?.targets?.map((t: any) => t.square));
  return (
    o.motif?.type === "fork" &&
    o.motif?.attacker?.square === "e6" &&
    targetSquares.has("d8") &&
    targetSquares.has("f8")
  );
}

function isAbsolutePinB5C6E8(o: any) {
  return (
    o.motif?.type === "pin" &&
    o.motif?.kind === "absolute" &&
    o.motif?.attacker?.square === "b5" &&
    o.motif?.pinned?.square === "c6" &&
    o.motif?.behind?.square === "e8"
  );
}

function isRelativePinB5C6D7(o: any) {
  return (
    o.motif?.type === "pin" &&
    o.motif?.kind === "relative" &&
    o.motif?.attacker?.square === "b5" &&
    o.motif?.pinned?.square === "c6" &&
    o.motif?.behind?.square === "d7"
  );
}

/**
 * Requirement: accept PGN with multiple games and output positions
 * where a fork or pin is CREATED (after - before).
 */
describe("analyzePgn", () => {
  it("handles multi-game PGN and emits only CREATED motifs with ply + fen", () => {
    // Fork game: use a SetUp/FEN so the fork is unquestionably practical:
    // White plays Ne6, forking Qf8 and Rd8. Knight cannot be captured immediately.
    const pgn = `
[Event "ForkGame"]
[SetUp "1"]
[FEN "3r1qk1/8/8/6N1/8/8/8/K7 w - - 0 1"]
1. Ne6 *

[Event "PinGame"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    const forkOcc = occurrences.find(
      (o) => o.gameIndex === 0 && o.ply === 1 && isForkFromE6(o),
    );

    const pinOcc = occurrences.find(
      (o) => o.gameIndex === 1 && o.ply === 6 && isAbsolutePinB5C6E8(o),
    );

    expect(forkOcc, "expected created fork occurrence in game 0").toBeTruthy();
    expect(pinOcc, "expected created pin occurrence in game 1").toBeTruthy();

    expect(forkOcc?.san).toBeTypeOf("string");
    expect(forkOcc?.fen).toBeTypeOf("string");
    expect(pinOcc?.san).toBeTypeOf("string");
    expect(pinOcc?.fen).toBeTypeOf("string");
  });

  it("works for a single-game PGN without headers (no [Event] blocks)", () => {
    const pgn = `1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *`;

    const { occurrences } = analyzePgn(pgn);

    const pinOcc = occurrences.find(
      (o) => o.gameIndex === 0 && o.ply === 6 && isAbsolutePinB5C6E8(o),
    );
    expect(pinOcc, "expected pin occurrence even without headers").toBeTruthy();
  });

  it("does not re-emit the same motif on later plies if it already existed (created diff)", () => {
    // Pin is created on ply 6 by ...d6. Then 4. O-O should NOT create the same pin again.
    const pgn = `
[Event "PinPersistence"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 4. O-O *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    const pinOccurrences = occurrences.filter(
      (o) => o.gameIndex === 0 && isAbsolutePinB5C6E8(o),
    );
    expect(pinOccurrences.length, "pin should be emitted exactly once").toBe(1);
    expect(pinOccurrences[0].ply, "pin should be created at ply 6").toBe(6);
  });

  it("handles Windows newlines and extra whitespace", () => {
    const pgn =
      '\r\n[Event "ForkGame"]\r\n' +
      '[SetUp "1"]\r\n' +
      '[FEN "3r1qk1/8/8/6N1/8/8/8/K7 w - - 0 1"]\r\n' +
      "1. Ne6 *\r\n\r\n" +
      '[Event "PinGame"]\r\n' +
      "1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *\r\n";

    const { occurrences } = analyzePgn(pgn);

    const hasFork = occurrences.some(
      (o) => o.gameIndex === 0 && o.ply === 1 && isForkFromE6(o),
    );
    const hasPin = occurrences.some(
      (o) => o.gameIndex === 1 && o.ply === 6 && isAbsolutePinB5C6E8(o),
    );

    expect(hasFork, "expected fork even with CRLF").toBe(true);
    expect(hasPin, "expected pin even with CRLF").toBe(true);
  });

  it("captures SAN for the key fork move (useful for UX/debugging)", () => {
    const pgn = `
[Event "ForkSan"]
[SetUp "1"]
[FEN "3r1qk1/8/8/6N1/8/8/8/K7 w - - 0 1"]
1. Ne6 *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    const forkOcc = occurrences.find(
      (o) => o.gameIndex === 0 && o.ply === 1 && isForkFromE6(o),
    );
    expect(forkOcc).toBeTruthy();
    expect(forkOcc!.san).toBe("Ne6");
  });

  it("emits a relative pin to the queen when it is created (king/queen pins only)", () => {
    // Need ...d6 first; otherwise Qd7 is illegal (pawn on d7 blocks the queen).
    // After 4...Qd7, bishop b5 pins knight c6 to queen d7 (relative pin).
    const pgn = `
[Event "RelativePinToQueen"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 4. O-O Qd7 *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    const relPinOcc = occurrences.find(
      (o) => o.gameIndex === 0 && o.ply === 8 && isRelativePinB5C6D7(o),
    );

    expect(
      relPinOcc,
      "expected created relative pin (b5 -> c6 -> d7)",
    ).toBeTruthy();
    expect(relPinOcc?.san).toBe("Qd7");
    expect(relPinOcc?.fen).toBeTypeOf("string");
  });
});
