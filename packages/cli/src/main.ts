#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import process from "process";
import { Command } from "commander";
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

    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });

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
    `Missing PGN input. Provide --input <file.pgn> or pipe via stdin.`,
  );
}

function writeOutput(payload: unknown, outPath?: string, pretty = false): void {
  const json = JSON.stringify(payload, null, pretty ? 2 : 0);

  if (!outPath) {
    process.stdout.write(json + "\n");
    return;
  }

  const full = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, json, "utf8");
}

function printSummary(occurrences: Occurrence[], sourceLabel: string): void {
  const forks = occurrences.filter((o) => o.motif.type === "fork").length;
  const pins = occurrences.filter((o) => o.motif.type === "pin").length;

  // stderr so JSON stdout stays clean
  process.stderr.write(
    `Analyzed ${sourceLabel}: ${occurrences.length} occurrences (forks=${forks}, pins=${pins})\n`,
  );
}

async function runAnalyze(opts: {
  input?: string;
  out?: string;
  pretty?: boolean;
  motifs?: string;
  summary?: boolean;
}): Promise<void> {
  const motifs = parseMotifs(opts.motifs);

  const { pgn, sourceLabel } = await loadPgn(opts.input);
  const result = analyzePgn(pgn);
  const filtered = filterOccurrences(result, motifs);

  if (opts.summary !== false) {
    printSummary(filtered.occurrences, sourceLabel);
  }

  writeOutput(filtered, opts.out, Boolean(opts.pretty));
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("tactics")
    .description("Detect created forks and pins in PGN (multi-game supported)")
    .version("1.0.0");

  program
    .command("analyze")
    .description("Analyze a PGN file (or stdin) and output JSON results")
    .option(
      "-i, --input <path>",
      "Input PGN file. If omitted, reads from stdin when piped.",
    )
    .option("-o, --out <path>", "Write output JSON to a file (default: stdout)")
    .option("--pretty", "Pretty-print JSON", false)
    .option(
      "--motifs <list>",
      "Comma-separated motif filter: fork,pin (default: both)",
    )
    .option("--no-summary", "Disable summary line on stderr")
    .action(
      async (opts: {
        input?: string;
        out?: string;
        pretty?: boolean;
        motifs?: string;
        summary?: boolean;
      }) => {
        await runAnalyze(opts);
      },
    );

  // Default command: tactics [input]
  program
    .argument("[input]", "Input PGN file (optional if piping via stdin)")
    .option("-o, --out <path>", "Write output JSON to a file (default: stdout)")
    .option("--pretty", "Pretty-print JSON", false)
    .option(
      "--motifs <list>",
      "Comma-separated motif filter: fork,pin (default: both)",
    )
    .option("--no-summary", "Disable summary line on stderr")
    .action(
      async (
        input: string | undefined,
        opts: {
          out?: string;
          pretty?: boolean;
          motifs?: string;
          summary?: boolean;
        },
      ) => {
        await runAnalyze({ ...opts, input });
      },
    );

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(msg + "\n");
  process.exit(1);
});
