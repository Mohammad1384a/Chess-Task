#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import process from "process";
import { parseArgs } from "util";
import { analyzePgn, type AnalysisResult, type Occurrence } from "@repo/core";

type MotifType = "fork" | "pin";

function parseMotifs(input?: string): Set<MotifType> | null {
  if (!input) return null;

  const parts = input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const allowed: ReadonlySet<MotifType> = new Set(["fork", "pin"]);
  const set = new Set<MotifType>();

  for (const p of parts) {
    if (!allowed.has(p as MotifType)) {
      throw new Error(`Invalid motif "${p}". Allowed: fork,pin`);
    }
    set.add(p as MotifType);
  }

  return set.size ? set : null;
}

function filterOccurrences(
  result: AnalysisResult,
  motifs: Set<MotifType> | null,
): AnalysisResult {
  if (!motifs) return result;
  const occurrences = result.occurrences.filter((o: Occurrence) =>
    motifs.has(o.motif.type as MotifType),
  );
  return { occurrences };
}

function readStdin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (err: Error) => reject(err));
  });
}

async function loadPgn(
  inputPath?: string,
): Promise<{ pgn: string; sourceLabel: string }> {
  if (inputPath) {
    const full = path.resolve(process.cwd(), inputPath);
    const pgn = fs.readFileSync(full, "utf8");
    return { pgn, sourceLabel: full };
  }

  if (!process.stdin.isTTY) {
    const pgn = await readStdin();
    return { pgn, sourceLabel: "stdin" };
  }

  throw new Error(
    "Missing PGN input. Provide --input <file.pgn> or pipe via stdin.",
  );
}

function writeOutput(payload: unknown, outPath?: string, pretty = false): void {
  const shouldPretty = pretty || (!outPath && process.stdout.isTTY);
  const json = JSON.stringify(payload, null, shouldPretty ? 2 : 0);

  if (!outPath) {
    process.stdout.write(json + "\n");
    return;
  }

  const full = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, json, "utf8");
  process.stderr.write(`Wrote ${full}\n`);
}

function printSummary(occurrences: Occurrence[], sourceLabel: string): void {
  const forks = occurrences.filter((o) => o.motif.type === "fork").length;
  const pins = occurrences.filter((o) => o.motif.type === "pin").length;

  process.stderr.write(
    `Analyzed ${sourceLabel}: ${occurrences.length} occurrences (forks=${forks}, pins=${pins})\n`,
  );
}

async function main(): Promise<void> {
  // Allow either:
  //   tactics analyze --input ...
  // or:
  //   tactics --input ...
  const raw = process.argv.slice(2);
  const args = raw[0] === "analyze" ? raw.slice(1) : raw;

  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      input: { type: "string", short: "i" },
      out: { type: "string", short: "o" },
      pretty: { type: "boolean" },
      motifs: { type: "string" },
      summary: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(
      [
        "Usage:",
        "  tactics analyze --input <file.pgn> [--out out.json] [--pretty] [--motifs fork,pin] [--summary]",
        "  tactics --input <file.pgn> [--out out.json] [--pretty] [--motifs fork,pin] [--summary]",
        "",
        "Options:",
        "  -i, --input <path>    Input PGN file (or pipe via stdin)",
        "  -o, --out <path>      Write output JSON to a file (default: stdout)",
        "  --pretty              Pretty-print JSON",
        "  --motifs <list>       Comma-separated: fork,pin",
        "  --summary             Print summary line on stderr",
        "  -h, --help            Show help",
        "",
      ].join("\n"),
    );
    return;
  }

  const input = values.input ?? (positionals[0] as string | undefined);
  const out = values.out;
  const pretty = Boolean(values.pretty);
  const motifs = parseMotifs(values.motifs);
  const summary = Boolean(values.summary);

  const { pgn, sourceLabel } = await loadPgn(input);
  const result = analyzePgn(pgn);
  const filtered = filterOccurrences(result, motifs);

  if (summary) {
    printSummary(filtered.occurrences, sourceLabel);
  }

  writeOutput(filtered, out, pretty);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(msg + "\n");
  process.exit(1);
});
