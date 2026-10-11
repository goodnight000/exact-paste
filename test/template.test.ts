import { describe, expect, it } from "vitest";
import { field } from "../eval/fields";
import { normalizeHeader, templateCandidates, templateMatch } from "../src/template";

function matched(source: string, label: string, nearby: string[] = []) {
  const result = templateMatch(source, field(label, "textarea", { nearby }));
  expect(result.status).toBe("match");
  if (result.status !== "match") throw new Error("expected a template match");
  expect(source.slice(result.candidate.start, result.candidate.end)).toBe(result.candidate.text);
  return result.candidate;
}

describe("headed templates", () => {
  it("matches known aliases for standalone and inline profile headers", () => {
    const source = "Full name: Zoë García\nEmail address\nzoe@example.com\n\nLinkedIn URL: https://linkedin.com/in/zoe\nWebsite: https://zoe.example";
    expect(matched(source, "LinkedIn").text).toBe("https://linkedin.com/in/zoe");
    expect(matched(source, "Email").text).toBe("zoe@example.com");
    expect(matched(source, "Name").text).toBe("Zoë García");
  });

  it("uses neighboring form labels for arbitrary standalone questions", () => {
    const source = "What are you building?\nA scheduling tool.\nWe started with clinics.\n\nWho needs it most?\nSmall teams.\n\nHow many users do you have?\n42";
    const candidate = matched(source, "Who needs it most?", ["What are you building?", "How many users do you have?"]);
    expect(candidate.text).toBe("Small teams.");
  });

  it("preserves nested headings and inline colons in a Markdown answer", () => {
    const answer = "We help clinics.\n\n## Why now\nOur thesis: scheduling wastes time.\nEmail: this line explains our channel.\n\n### Details\nOne more paragraph.";
    const source = `# What are you building?\n${answer}\n\n# Who needs it most?\nClinic owners.`;
    expect(matched(source, "What are you building?").text).toBe(answer);
  });

  it("keeps plain answer subheaders and numbered lists", () => {
    const answer = "We saw this firsthand.\n\nThe plan:\n1. Start small.\n2. Grow.";
    const source = `Why did you pick this idea?\n${answer}\n\nWhat are you building?\nA useful tool.`;
    expect(matched(source, "Why did you pick this idea?", ["What are you building?"]).text).toBe(answer);
  });

  it("does not silently cut prose at a known profile label that is not a form peer", () => {
    const source = "What are you building?\nOur product uses labels.\nEmail: this is an example in the answer.\n\nWho needs it most?\nTeams.";
    expect(templateMatch(source, field("What are you building?", "textarea", { nearby: ["Who needs it most?"] }))).toEqual({ status: "ambiguous", reason: "unclear-boundary" });
  });

  it("recognizes an exact neighboring plain question after a Markdown answer", () => {
    const source = "# What are you building?\nA scheduling tool.\n\nWho needs it most?\nTeams.";
    expect(matched(source, "What are you building?", ["Who needs it most?"]).text).toBe("A scheduling tool.");
  });

  it("supports numbered questions, CRLF, and Unicode without rewriting answers", () => {
    const answer = "Café tools for Zoë.\r\nThesis: less waiting.\r\n\r\n日本語も使えます。";
    const source = `1. What are you building?\r\n${answer}\r\n\r\n2) Why did you pick this idea?\r\nWe needed it.`;
    expect(matched(source, "What are you building?").text).toBe(answer);
  });

  it("does not interpret headings inside a fenced code block", () => {
    const answer = "Our template:\n```markdown\n# Who needs it most?\nEmail: sample@example.com\n```\nWe show the syntax.";
    const source = `# What are you building?\n${answer}\n\n# Who needs it most?\nTeams.`;
    expect(matched(source, "What are you building?").text).toBe(answer);
  });

  it("finds a late header and preserves an answer far beyond the model window", () => {
    const answer = "A paragraph: " + "large answer text.\r\n".repeat(800);
    const source = "unrelated text\n".repeat(2000) + `\r\n# What are you building?\r\n${answer}\r\n# Who needs it most?\r\nTeams.`;
    expect(matched(source, "What are you building?").text).toBe(answer.trimEnd());
    expect(matched(source, "Who needs it most?").start).toBeGreaterThan(12_000);
  });

  it("rejects conflicting duplicate aliases anywhere in the full source", () => {
    const source = "LinkedIn: https://linkedin.com/in/first\n\n" + "plain notes\n".repeat(2000) + "\nLinkedIn URL: https://linkedin.com/in/second";
    expect(templateMatch(source, field("LinkedIn", "url"))).toEqual({ status: "ambiguous", reason: "conflicting-headers" });
  });

  it("allows repeated identical answers but rejects an explicitly empty answer", () => {
    const same = "Email: you@example.com\nEmail address: you@example.com";
    expect(matched(same, "Email").text).toBe("you@example.com");
    expect(templateMatch("Email:\nLinkedIn: https://linkedin.com/in/you", field("Email", "email"))).toEqual({ status: "ambiguous", reason: "empty-header" });
  });

  it("does not erase personal/work qualifiers or borrow an internal title name", () => {
    expect(templateMatch("Personal email: you@example.com", field("Work email", "email"))).toEqual({ status: "mismatch" });
    expect(templateMatch("Job title: Engineer", field("Issue title", "text", { name: "title" }))).toEqual({ status: "none" });
  });

  it("handles bold inline delimiters and required markers", () => {
    expect(matched("**Email:** you@example.com\n**LinkedIn:** https://linkedin.com/in/you", "Email address (required)").text).toBe("you@example.com");
    expect(normalizeHeader("2. What’s your idea? (required) *")).toBe("whats your idea");
  });

  it("bounds generated candidates for a document with many body headings", () => {
    const source = "**Body heading**\n".repeat(20_000);
    const candidates = templateCandidates(source);
    expect(candidates.length).toBeLessThanOrEqual(40);
    for (const candidate of candidates) expect(source.slice(candidate.start, candidate.end)).toBe(candidate.text);
  });
});
