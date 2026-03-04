import { describe, it, expect } from "vitest";
import { analyzePgn } from "../src";

function isForkFromF7(o: any) {
  return (
    o.motif?.type === "fork" &&
    o.motif?.attacker?.square === "f7" &&
    new Set(o.motif?.targets?.map((t: any) => t.square)).has("d8") &&
    new Set(o.motif?.targets?.map((t: any) => t.square)).has("h8")
  );
}

function isPinB5C6E8(o: any) {
  return (
    o.motif?.type === "pin" &&
    o.motif?.kind === "absolute" &&
    o.motif?.attacker?.square === "b5" &&
    o.motif?.pinned?.square === "c6" &&
    o.motif?.behind?.square === "e8"
  );
}

/**
 * Requirement: accept PGN with multiple games and output positions
 * where a fork or pin is CREATED (after - before).
 */
describe("analyzePgn", () => {
  it("handles multi-game PGN and emits only CREATED motifs with ply + fen", () => {
    const pgn = `
[Event "ForkGame"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 *

[Event "PinGame"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    const forkOcc = occurrences.find(
      (o) => o.gameIndex === 0 && o.ply === 11 && isForkFromF7(o),
    );

    const pinOcc = occurrences.find(
      (o) => o.gameIndex === 1 && o.ply === 6 && isPinB5C6E8(o),
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
      (o) => o.gameIndex === 0 && o.ply === 6 && isPinB5C6E8(o),
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
      (o) => o.gameIndex === 0 && isPinB5C6E8(o),
    );
    expect(pinOccurrences.length, "pin should be emitted exactly once").toBe(1);
    expect(pinOccurrences[0].ply, "pin should be created at ply 6").toBe(6);
  });

  it("handles Windows newlines and extra whitespace", () => {
    const pgn =
      '\r\n[Event "ForkGame"]\r\n' +
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 *\r\n\r\n" +
      '[Event "PinGame"]\r\n' +
      "1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *\r\n";

    const { occurrences } = analyzePgn(pgn);

    const hasFork = occurrences.some(
      (o) => o.gameIndex === 0 && o.ply === 11 && isForkFromF7(o),
    );
    const hasPin = occurrences.some(
      (o) => o.gameIndex === 1 && o.ply === 6 && isPinB5C6E8(o),
    );

    expect(hasFork, "expected fork even with CRLF").toBe(true);
    expect(hasPin, "expected pin even with CRLF").toBe(true);
  });

  it("captures SAN for the key fork move (useful for UX/debugging)", () => {
    const pgn = `
[Event "ForkSan"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    const forkOcc = occurrences.find(
      (o) => o.gameIndex === 0 && o.ply === 11 && isForkFromF7(o),
    );
    expect(forkOcc).toBeTruthy();
    expect(forkOcc!.san).toBe("Nxf7");
  });
});

/**
 * Requirement: accept PGN with multiple games and output positions
 * where a fork or pin is CREATED (after - before). :contentReference[oaicite:1]{index=1}
 */
describe("analyzePgn", () => {
  it("handles multi-game PGN and emits only CREATED motifs with ply + fen", () => {
    const pgn = `
[Event "ForkGame"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 *

[Event "PinGame"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *
`.trim();

    const { occurrences } = analyzePgn(pgn);

    // Fork: created on white ply 11 (the move "Nxf7")
    const forkOcc = occurrences.find(
      (o) =>
        o.gameIndex === 0 &&
        o.ply === 11 &&
        o.motif.type === "fork" &&
        o.motif.attacker.square === "f7",
    );

    // Pin: created after black plays "d6" => ply 6, and it creates a WHITE pin
    const pinOcc = occurrences.find(
      (o) =>
        o.gameIndex === 1 &&
        o.ply === 6 &&
        o.motif.type === "pin" &&
        o.motif.attacker.square === "b5" &&
        o.motif.pinned.square === "c6" &&
        o.motif.behind.square === "e8",
    );

    expect(forkOcc, "expected created fork occurrence in game 0").toBeTruthy();
    expect(pinOcc, "expected created pin occurrence in game 1").toBeTruthy();

    // San + fen should be present for debugging / downstream tooling
    expect(forkOcc?.san).toBeTypeOf("string");
    expect(forkOcc?.fen).toBeTypeOf("string");
    expect(pinOcc?.san).toBeTypeOf("string");
    expect(pinOcc?.fen).toBeTypeOf("string");
  });
});
