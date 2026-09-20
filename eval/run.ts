import { readFileSync } from "node:fs";
import { decide } from "../src/decide";
import { createAsk } from "../src/jev";
import { decideFixtures } from "./decide-fixtures";
import { scoreDecide } from "./score";
import type { DecideResult } from "./types";

function loadKey(): string {
  let text = "";
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return (process.env.TYPESAFE_API_KEY ?? "").trim();
  }
  for (const line of text.split(/\n/)) {
    const i = line.indexOf("=");
    if (i === -1) continue;
    if (line.slice(0, i).trim() === "TYPESAFE_API_KEY") return line.slice(i + 1).trim();
  }
  return (process.env.TYPESAFE_API_KEY ?? "").trim();
}

function preview(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > 64 ? `${flat.slice(0, 61)}…` : flat;
}

const key = loadKey();
if (!key) {
  console.error("Set TYPESAFE_API_KEY in .env");
  process.exit(2);
}

const ask = createAsk(key);
const results: DecideResult[] = [];
for (const fixture of decideFixtures) {
  const started = Date.now();
  const got = await decide(fixture.clipboard, fixture.field, ask);
  results.push(scoreDecide(fixture.id, fixture.clipboard, fixture.expect, got, Date.now() - started));
}

const pass = results.filter((row) => row.verdict === "pass");
const miss = results.filter((row) => row.verdict === "safe_miss");
const unsafe = results.filter((row) => row.verdict === "unsafe");
const times = results.map((row) => row.ms).sort((a, b) => a - b);
const p50 = times[Math.floor(times.length / 2)] ?? 0;

console.log("id".padEnd(28), "verdict".padEnd(12), "ms".padStart(5), "reason".padEnd(16), "got");
for (const row of results) {
  console.log(
    row.id.padEnd(28),
    row.verdict.padEnd(12),
    String(row.ms).padStart(5),
    row.reason.padEnd(16),
    preview(row.gotValue),
  );
}
console.log("");
console.log(
  JSON.stringify({
    cases: results.length,
    pass: pass.length,
    safe_miss: miss.length,
    unsafe: unsafe.length,
    pass_rate: Number((pass.length / results.length).toFixed(3)),
    safe_rate: Number(((pass.length + miss.length) / results.length).toFixed(3)),
    p50_ms: p50,
    unsafe_ids: unsafe.map((row) => row.id),
    safe_miss_ids: miss.map((row) => row.id),
  }),
);

if (unsafe.length) process.exit(1);
