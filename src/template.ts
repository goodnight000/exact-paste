import type { Candidate, FieldInfo } from "./types";

// These aliases name the same slot. Qualifiers such as personal/work or
// company/personal deliberately remain distinct.
const ALIASES = [
  ["linkedin", "linkedin url", "linkedin profile", "linkedin profile url", "linkedin link"],
  ["github", "github url", "github profile", "github profile url", "github link"],
  ["twitter", "x twitter", "twitter profile", "x profile", "twitter url", "x twitter profile"],
  ["website", "website url", "web site", "url"],
  ["personal website", "personal website url", "personal site"],
  ["company website", "company website url", "company site"],
  ["portfolio", "portfolio url", "portfolio website"],
  ["email", "email address", "e mail", "e mail address"],
  ["work email", "work email address", "business email", "business email address"],
  ["personal email", "personal email address"],
  ["phone", "phone number", "telephone", "telephone number", "tel"],
  ["mobile phone", "mobile", "mobile number", "cell phone", "cell", "cellphone"],
  ["office phone", "office phone number", "work phone", "work phone number"],
  ["home phone", "home phone number", "personal phone", "personal phone number"],
  ["full name", "name"],
  ["first name", "given name"],
  ["last name", "family name", "surname"],
  ["middle name", "additional name"],
  ["company", "company name", "organization", "organization name", "current company"],
  ["job title", "current role", "current job title", "role", "occupation"],
  ["street address", "street", "address", "address line 1"],
  ["city", "town"],
  ["state", "province", "state province"],
  ["zip", "zip code", "postal code", "postcode"],
  ["country", "country name"],
  ["bio", "biography"],
  ["professional summary", "profile", "summary"],
  ["invoice number", "invoice no", "invoice"],
  ["amount due", "amount"],
  ["due date", "due"],
] as const;

function stripTrailingHeaderMarks(label: string): string {
  let end = label.length;
  while (end > 0 && /[\s:*#]/.test(label[end - 1]!)) end--;
  return end === label.length ? label : label.slice(0, end);
}

export function normalizeHeader(label: string): string {
  const heading = stripTrailingHeaderMarks(label
    .normalize("NFKC")
    .replace(/^\s*(?:#{1,6}\s+|(?:\d+[.)]|Q(?:uestion)?\s*\d+[.):]?)\s+)/i, ""));
  return heading
    .replace(/(?:\(\s*(?:required|optional)\s*\)|\[\s*(?:required|optional)\s*\])$/i, "")
    .replace(/[’']/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    // Default Unicode casing avoids per-line Intl setup on huge documents.
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const canonical = new Map<string, string>();
for (const group of ALIASES) {
  for (const alias of group) canonical.set(normalizeHeader(alias), group[0]);
}

function key(label: string): string {
  const normalized = normalizeHeader(label);
  return canonical.get(normalized) ?? canonical.get(normalized.replace(/^(?:your|my|the)\s+/, "")) ?? normalized;
}

type Line = { text: string; start: number; end: number; next: number };
type Header = {
  key: string;
  start: number;
  answerStart: number;
  kind: "markdown" | "numbered" | "bold" | "colon" | "plain";
  level: number;
  known: boolean;
  question: boolean;
  peer: boolean;
  blankBefore: boolean;
};

function linesOf(source: string): Line[] {
  const lines: Line[] = [];
  for (const match of source.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
    if (!match[0]) break;
    const raw = match[0];
    const text = raw.replace(/(?:\r\n|\r|\n)$/, "");
    const start = match.index;
    lines.push({ text, start, end: start + text.length, next: start + raw.length });
  }
  return lines;
}

function labelsFor(field: FieldInfo): Set<string> {
  // A DOM name like "title" must not override a visible label like "Issue title".
  const primary = field.label.trim() || field.placeholder.trim() || field.name || field.id;
  const machineLabel = primary.replace(/([a-z])([A-Z])/g, "$1 $2");
  return new Set([key(primary), key(machineLabel)].filter(Boolean));
}

export function headerMatchesField(label: string, field: FieldInfo): boolean {
  return labelsFor(field).has(key(label));
}

export function templateHasPeerHeaders(source: string, field: FieldInfo): boolean {
  const targets = labelsFor(field);
  const peers = new Set(field.nearby.map(key).filter((label) => label && !targets.has(label)));
  if (!peers.size) return false;
  const headers = headersOf(source, targets, peers);
  const ends = answerEnds(headers, source.length);
  return headers.some((header, index) => peers.has(header.key) &&
    (header.kind !== "plain" || header.blankBefore) &&
    answerCandidate(source, header, ends[index]!, index).text.trim().length > 0);
}

function headersOf(source: string, targets: Set<string>, peers: Set<string>): Header[] {
  const lines = linesOf(source);
  const headers: Header[] = [];
  let fence: { mark: string; width: number } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const text = line.text.trim();
    const fenceLine = line.text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceLine) {
      const mark = fenceLine[1]![0]!;
      const width = fenceLine[1]!.length;
      if (!fence) fence = { mark, width };
      else if (mark === fence.mark && width >= fence.width) fence = null;
      continue;
    }
    if (fence || !text) continue;
    const blankBefore = index === 0 || !lines[index - 1]!.text.trim();
    // Closing heading marks are stripped by normalizeHeader. Matching an
    // optional whitespace tail here rescans giant internal whitespace runs.
    const markdown = line.text.match(/^\s{0,3}(#{1,6})[ \t]+(.+)$/);
    const numbered = line.text.match(/^\s{0,3}(?:\d{1,4}[.)]|Q(?:uestion)?\s*\d{1,4}[.):]?)[ \t]+(.+)$/i);
    const bold = line.text.match(/^\s{0,3}(?:\*\*|__)(.+?)(?:\*\*|__)(?:[ \t]*:)?[ \t]*$/);
    let label = markdown?.[2] ?? numbered?.[1] ?? bold?.[1] ?? text;
    let answerStart = line.next;
    let colon = false;
    // Splitting only the label syntax leaves colons inside the answer untouched.
    const colonAt = label.indexOf(":");
    if (colonAt >= 0 && !/^https?:\/\//i.test(label)) {
      const before = label.slice(0, colonAt).replace(/\*\*|__/g, "").trim();
      const beforeKey = key(before);
      const plausible = before.length <= 300 && before.split(/\s+/).length <= 35 && !/[\n@]/.test(before);
      if (targets.has(beforeKey) || peers.has(beforeKey) || canonical.has(beforeKey) || plausible) {
        const labelAt = line.text.indexOf(label);
        answerStart = line.start + labelAt + colonAt + 1;
        const marker = label.match(/^(\*\*|__)/)?.[1];
        if (marker && source.slice(answerStart, answerStart + marker.length) === marker) answerStart += marker.length;
        label = before;
        colon = true;
      }
    }
    const labelKey = key(label);
    if (!labelKey) continue;
    const known = targets.has(labelKey) || peers.has(labelKey) || canonical.has(labelKey);
    const question = label.trimEnd().replace(/(?:\*\*|__)$/, "").trimEnd().endsWith("?");
    if (!markdown && !bold && !known && !(numbered && question) && !(colon && question)) continue;
    // Numbered answer lists are ordinary body text, unless the line is a question
    // or exactly names a recognized form label.
    if (numbered && !known && !question) continue;
    const kind = markdown ? "markdown" : numbered ? "numbered" : bold ? "bold" : colon ? "colon" : "plain";
    headers.push({ key: labelKey, start: line.start, answerStart, kind, level: markdown?.[1]?.length ?? 0, known, question, peer: targets.has(labelKey) || peers.has(labelKey), blankBefore });
  }
  return headers;
}

function answerEnds(headers: Header[], sourceLength: number): number[] {
  const ends = new Array<number>(headers.length);
  const markdown = new Array<number>(7).fill(sourceLength);
  let common = sourceLength;
  let bold = sourceLength;
  let mixedPeer = sourceLength;
  // Compute the next eligible boundary once. A document with thousands of
  // headings must not repeatedly scan the remaining document for every answer.
  for (let index = headers.length - 1; index >= 0; index--) {
    const header = headers[index]!;
    // Nested Markdown subheadings remain inside their parent answer.
    ends[index] = header.kind === "markdown"
      ? Math.min(mixedPeer, ...markdown.slice(1, header.level + 1))
      : header.kind === "bold" ? Math.min(common, bold) : common;
    if (header.kind === "markdown") {
      markdown[header.level] = header.start;
      if (header.known && header.blankBefore) common = header.start;
    } else if (header.known || header.kind === "numbered" || (header.kind === "colon" && header.question)) {
      common = header.start;
    }
    if (header.kind === "bold" && header.blankBefore) bold = header.start;
    if (header.kind !== "markdown" && header.peer && header.blankBefore) mixedPeer = header.start;
  }
  return ends;
}

function answerCandidate(source: string, header: Header, boundary: number, index: number): Candidate {
  let end = boundary;
  let start = header.answerStart;
  while (start < end && /\s/u.test(source[start]!)) start++;
  while (end > start && /\s/u.test(source[end - 1]!)) end--;
  return { id: `h${index}`, text: source.slice(start, end), start, end };
}

export type TemplateMatch =
  | { status: "none" }
  | { status: "mismatch" }
  | { status: "ambiguous"; reason: "conflicting-headers" | "empty-header" | "unclear-boundary" }
  | { status: "match"; candidate: Candidate };

export function templateMatch(source: string, field: FieldInfo): TemplateMatch {
  const targets = labelsFor(field);
  const peers = new Set(field.nearby.map(key).filter(Boolean));
  const headers = headersOf(source, targets, peers);
  const ends = answerEnds(headers, source.length);
  const byStart = new Map(headers.map((header) => [header.start, header]));
  const matches: Candidate[] = [];
  for (let index = 0; index < headers.length; index++) {
    const header = headers[index]!;
    if (!targets.has(header.key)) continue;
    const longAnswerHeader = !canonical.has(header.key) || header.key === "bio" || header.key === "professional summary";
    if (field.kind === "textarea" && longAnswerHeader && header.kind !== "markdown") {
      const boundary = byStart.get(ends[index]!);
      // A label-like line inside prose may be an example, rather than the next
      // form answer. Only the actual neighboring form labels disambiguate it.
      if (boundary?.known && !boundary.peer && !boundary.question && boundary.kind !== "numbered") {
        return { status: "ambiguous", reason: "unclear-boundary" };
      }
    }
    matches.push(answerCandidate(source, header, ends[index]!, index));
  }
  if (!matches.length) {
    const target = [...targets][0] ?? "";
    const family = field.kind === "email" ? "email" : field.kind === "tel" ? "phone" : /\bwebsite\b/.test(target) ? "website" : null;
    // A lone explicitly personal address is not proof of someone's work
    // address. Do not let a unique scalar bypass an incompatible header.
    if (family && target !== family && headers.some((header) => header.known && header.key.includes(family))) return { status: "mismatch" };
    return { status: "none" };
  }
  if (matches.some((candidate) => !candidate.text)) return { status: "ambiguous", reason: "empty-header" };
  if (new Set(matches.map((candidate) => candidate.text)).size !== 1) {
    return { status: "ambiguous", reason: "conflicting-headers" };
  }
  return { status: "match", candidate: matches[0]! };
}

export function templateCandidates(source: string): Candidate[] {
  const headers = headersOf(source, new Set(), new Set());
  const ends = answerEnds(headers, source.length);
  return headers.slice(0, 40).map((header, index) => answerCandidate(source, header, ends[index]!, index)).filter((candidate) => candidate.text);
}
