# Chess Tactics Detector (Forks + Pins)

A small TypeScript tool that analyzes **PGN files (including multi-game PGNs)** and outputs **positions where a fork or pin is _created_**.

This repo contains:

- `@repo/core`: pure, testable detection logic
- `@repo/cli`: a CLI wrapper (`tactics`) to run analysis locally

Workspace packages: `packages/core`, `packages/cli`.

---

## What changed based on reviewer feedback

We updated the implementation to match practical chess definitions:

- **Pins**
  - Detect **absolute pins** (to the king) **and** **relative pins** (to the queen).
  - Do **not** report a pin if the pinned piece can **legally capture** the pinner and that capture is not losing material (practical false-pin removal).

- **Forks**
  - Moved from purely geometric forks to **practical forks**: legal, survivable attacker, and should **win material** (or be a forcing check that still leads to material gain).
  - Avoid forks that are trivially neutralized (e.g., attacker can be immediately captured, or the “forked” piece is easily defended with no gain).

- **PGN support**
  - Multi-game PGN supported.
  - Also supports PGNs that include `[SetUp "1"]` + `[FEN "..."]` tags (non-standard start positions).

---

## Definitions (what we detect)

### Pins (to king or queen)

A **pin** is detected when:

- the attacker is a **bishop, rook, or queen**
- along a straight line (diagonal/file/rank), the attacker sees:
  1. an enemy piece (the pinned piece)
  2. and behind it the **enemy king** (absolute pin) **or** **enemy queen** (relative pin)
- the pinned piece is **never the king** (a king cannot be pinned)

Practical rule:

- if the pinned piece can **legally capture** the pinning piece and that capture is **not losing** (wins material or trades equally), we do **not** count it as a pin.

Output includes:

- `kind: "absolute" | "relative"`
- `attacker` (square/piece/color)
- `pinned` (square/piece/color)
- `behind` (square/piece/color) — king or queen

---

### Forks (practical)

A **fork** is detected when:

- a single attacker attacks **2+ enemy targets** in the same position
- pawn targets are ignored (signal/noise), but **king** always counts as a target

Practical rules (high-level):

- the fork should represent a **material threat** (net gain, “more than you give”)
- the attacker must be **survivable** (not trivially capturable immediately)
- for non-king targets, the attacker must be able to **legally capture** the target (pinned attackers don’t count)
- at least one target should be **hanging**, or defended targets should be **higher value** than the attacker (e.g., knight forking rook/queen)
- exclude “geometric forks” that are trivially neutralized (examples from reviewer)

Output includes:

- `attacker` (square/piece/color)
- `targets[]` (square/piece/color)

---

## What “created” means

A tactic is considered **created on a ply** if it exists in the **after-position** of that ply, but **did not exist** in the **before-position** of that ply.

Implementation:

- for each move:
  - compute motifs in `beforeFen`
  - compute motifs in `afterFen`
  - emit only `(after − before)` (set difference via stable motif signatures)

Note: a move can create tactics for **either side**, so we detect created motifs for **both colors** after each ply.

---

## Output format (JSON)

The CLI prints JSON like:

```json
{
  "occurrences": [
    {
      "gameIndex": 0,
      "ply": 1,
      "san": "Ne6",
      "fen": "<after-position FEN>",
      "motif": {
        "type": "fork",
        "attacker": { "square": "e6", "piece": "n", "color": "w" },
        "targets": [
          { "square": "d8", "piece": "r", "color": "b" },
          { "square": "f8", "piece": "q", "color": "b" }
        ]
      }
    }
  ]
}
```

Fields:

- `gameIndex`: 0-based game index in the multi-game PGN
- `ply`: 1-based half-move number
- `san`: SAN move notation for that ply
- `fen`: board snapshot after the move
- `motif`: fork/pin details

---

## Project structure

```
packages/
  core/   # pure logic (forks, pins, PGN analysis)
  cli/    # CLI wrapper around core
```

Design goals:

- **core** is deterministic + unit-tested
- **cli** is IO-only (no chess logic)

---

## Run locally (step-by-step)

### Prerequisites

- Node.js 20+
- pnpm 10+

### 1) Install deps

```bash
pnpm install
```

If pnpm warns:

> Ignored build scripts: esbuild...

Approve builds (pick `esbuild`), then reinstall:

```bash
pnpm approve-builds
pnpm install
```

### 2) Run tests

```bash
pnpm -C packages/core test
```

### 3) Build

```bash
pnpm -C packages/core build
pnpm -C packages/cli build
```

### 4) Analyze a PGN

#### Option A: Use the included `sample.pgn`

```bash
node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty
```

#### Option B: Create a sample PGN

Bash:

```bash
cat > sample.pgn << 'PGN'
[Event "ForkGame"]
[SetUp "1"]
[FEN "3r1qk1/8/8/6N1/8/8/8/K7 w - - 0 1"]
1. Ne6 *

[Event "PinGame"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *
PGN
```

PowerShell:

```powershell
@'
[Event "ForkGame"]
[SetUp "1"]
[FEN "3r1qk1/8/8/6N1/8/8/8/K7 w - - 0 1"]
1. Ne6 *

[Event "PinGame"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 *
'@ | Set-Content -NoNewline sample.pgn
```

Run:

```bash
node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty
```

---

## CLI options

- Pretty JSON:

  ```bash
  node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty
  ```

- Filter motifs:

  ```bash
  node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty --motifs fork
  node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty --motifs pin
  ```

- Write to a file:

  ```bash
  node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty --out out.json
  ```

- Print summary (stderr):

  ```bash
  node packages/cli/dist/main.js analyze --input ./sample.pgn --pretty --summary
  ```

- Read from stdin:
  ```bash
  cat ./sample.pgn | node packages/cli/dist/main.js analyze --pretty
  ```

---

## Notes / tradeoffs

- Pins are limited to **king** and **queen** (absolute/relative). Pins to other pieces are not reported.
- Fork detection uses practical heuristics to reflect how players evaluate forks (material win / survivability / legality).
