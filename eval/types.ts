import type { FieldInfo } from "../src/types";

export type SlotFixture = {
  id: string;
  layer: "slot";
  html: string;
  focus: string;
  expect: { slot: boolean };
  note?: string;
};

export type DecideExpect = {
  mode: "slice" | "whole";
  value?: string;
  any_of?: string[];
};

export type DecideFixture = {
  id: string;
  layer: "decide";
  clipboard: string;
  field: FieldInfo;
  expect: DecideExpect;
  note?: string;
};

export type Verdict = "pass" | "safe_miss" | "unsafe";

export type DecideResult = {
  id: string;
  verdict: Verdict;
  ms: number;
  gotMode: "slice" | "whole";
  gotValue: string;
  reason: string;
  expected: string;
};
