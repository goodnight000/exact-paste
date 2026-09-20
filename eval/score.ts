import type { Decision } from "../src/types";
import type { DecideExpect, DecideResult, Verdict } from "./types";

export function expectedValues(clipboard: string, expect: DecideExpect): string[] {
  const values = [...(expect.any_of ?? [])];
  if (expect.value !== undefined) values.push(expect.value);
  if (expect.mode === "whole") values.push(clipboard);
  return [...new Set(values)];
}

export function scoreDecide(
  id: string,
  clipboard: string,
  expect: DecideExpect,
  got: Decision,
  ms: number,
): DecideResult {
  const wanted = expectedValues(clipboard, expect);
  const expected = wanted.join(" | ");
  let verdict: Verdict;
  if (wanted.includes(got.value)) {
    verdict = "pass";
  } else if (got.mode === "whole" && got.value === clipboard && expect.mode === "slice") {
    verdict = "safe_miss";
  } else {
    verdict = "unsafe";
  }
  return {
    id,
    verdict,
    ms,
    gotMode: got.mode,
    gotValue: got.value,
    reason: got.reason,
    expected,
  };
}
