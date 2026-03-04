# Chess Tactics Detector (Forks + Pins)

A small TypeScript tool that analyzes **PGN files (including multi-game PGNs)** and outputs the **positions where a fork or pin is created**.

The project is intentionally backend-only (no UI) and provides:

- a **core library** (`@repo/core`) with pure detection logic
- a **CLI** (`tactics`) to run analysis locally

---

## What the tool detects

### Pins (absolute pins)

A **pin** is detected when:

- the attacker is a **bishop, rook, or queen**
- along a straight line (diagonal/file/rank), the attacker sees:
  1. an enemy piece (the _pinned_ piece)
  2. and behind it the **enemy king**
- the **king is never considered “pinned”** (king cannot be pinned)

Output includes:

- `attacker` (square/piece/color)
- `pinned` (square/piece/color)
- `behind` (the king square/piece/color)
- `kind: "absolute"`

### Forks

A **fork** is detected when:

- a single attacker piece attacks **2 or more enemy pieces** in the same position
- to keep output high-signal, **pawn targets are ignored**
  - King is always counted as a valid target
  - All other targets must be **minor+** (value ≥ 3)

Output includes:

- `attacker` (square/piece/color)
- `targets[]` (square/piece/color)

---

## What “created” means

A tactic is considered **created on a ply** if it exists in the **after-position** of that ply, but did **not** exist in the **before-position** of that ply.

Implementation-wise:

- for each move:
  - compute motifs in `beforeFen`
  - compute motifs in `afterFen`
  - emit only `(after − before)` (set difference via stable motif signatures)

Important detail:

- a move can create tactics for **either side**, so we check “created motifs” for **both colors** after each ply.

---

## Output format (JSON)

The CLI prints JSON like:

```json
{
  "occurrences": [
    {
      "gameIndex": 0,
      "ply": 11,
      "san": "Nxf7",
      "fen": "<after-position FEN>",
      "motif": {
        "type": "fork",
        "attacker": { "square": "f7", "piece": "n", "color": "w" },
        "targets": [
          { "square": "h8", "piece": "r", "color": "b" },
          { "square": "d8", "piece": "q", "color": "b" }
        ]
      }
    }
  ]
}
```

Where:

gameIndex: index of the game in the multi-game PGN (0-based)

ply: half-move number (1-based)

san: SAN of the move played on that ply

fen: board snapshot after the move

motif: fork/pin details

Project structure
packages/
core/ # pure logic (detect forks/pins, analyze multi-game PGN)
cli/ # CLI wrapper around core

Design goals:

core is deterministic + testable

CLI is thin glue (IO only)

How to run the project locally
Prerequisites

Node.js 20+
pnpm 10+

1. Install dependencies

From repo root:

`pnpm install`

2. Run tests (core)
   `pnpm -C packages/core test`

3. Build

Build core first (emits dist/index.js + dist/index.d.ts), then build the CLI:

`pnpm -C packages/core build`
`pnpm -C packages/cli build`

4. Analyze a PGN

Create a sample file (or use your own PGN) run this command in a Bash terminal(not powershell):

`cat > sample.pgn << 'PGN'
[Event "ForkGame"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 \*

[Event "PinGame"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 \*
   PGN`

Run the CLI:

`node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty`

Optional:

filter motifs:

`node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty --motifs fork`

write to a file:

`node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty --out out.json`

Notes / tradeoffs

Pin detection currently implements absolute pins (pinned to the king).

Relative pins (pinned to higher value piece) can be added later if needed.

Fork detection ignores pawn targets to reduce noise.

This can be relaxed if a broader definition is desired.
