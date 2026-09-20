export type FieldKind = "email" | "url" | "tel" | "text" | "textarea";

export type FieldInfo = {
  label: string;
  kind: FieldKind;
  type: string;
  name: string;
  id: string;
  autocomplete: string;
  placeholder: string;
  tag: string;
  nearby: string[];
};

export type Candidate = {
  id: string;
  text: string;
  start: number;
  end: number;
};

export type Decision = {
  value: string;
  mode: "slice" | "whole";
  reason: string;
};

export type JevChoice = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type JevNoul = {
  type: "noul";
  noul: number;
};

export type JevAnswers = Record<string, JevChoice | JevNoul>;

export type JevAsk = (
  state: unknown,
  questions: Record<string, unknown>,
  timeoutMs: number,
) => Promise<JevAnswers>;
