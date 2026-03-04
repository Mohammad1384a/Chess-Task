import { describe, it, expect } from "vitest";
import { analyzePgn } from "../src";

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
