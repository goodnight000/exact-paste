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

  it("answers a one-line field from an inline header's own line", () => {
    const bill = "Norr Press LLC\nDue: 12 May 2026\nBill to:\nKeel Ceramics\nDescription\nQty\nAmount\nHang tags\n500\n1240.00\nAmount due: 1240.00\nRemit to:\n88 Bond Street";
    for (const [label, want] of [["Amount", "1240.00"], ["Due date", "12 May 2026"]]) {
      const result = templateMatch(bill, field(label, "text"));
      expect(result.status === "match" && result.candidate.text).toBe(want);
    }
    const note = "Company\nHybrid Audio\n\nTitle\nStaff Sound Designer\n\nAddress\n2140 Folsom St";
    const company = templateMatch(note, field("Current company", "text"));
    expect(company.status === "match" && company.candidate.text).toBe("Hybrid Audio");
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

  it("normalizes Unicode header casing, width, and punctuation without locale setup", () => {
    const source = "# ＷＨＡＴ’s your idea？\nCafé tools.\n\n# ÉQUIPE ET MARCHÉS\n日本語の回答";
    expect(matched(source, "What's your idea?").text).toBe("Café tools.");
    expect(matched(source, "Équipe et marchés").text).toBe("日本語の回答");
    expect(normalizeHeader("İletişim")).toBe("i\u0307letişim");
  });

  it("handles giant internal whitespace without rescanning every possible suffix", () => {
    const gap = " ".repeat(100_000);
    expect(normalizeHeader(`A${gap}B`)).toBe("a b");
    expect(normalizeHeader(`Idea (required)${gap}B`)).toBe("idea required b");
    const source = `A${gap}B\n\n## Email\nyou@example.com`;
    expect(matched(source, "Email").text).toBe("you@example.com");
    expect(matched(`# A${gap}B\n\n## Email\nyou@example.com`, "Email").text).toBe("you@example.com");
    expect(matched(`**A**${gap}B\n\n## Email\nyou@example.com`, "Email").text).toBe("you@example.com");
    expect(matched(`A?${gap}B\n\n## Email\nyou@example.com`, "Email").text).toBe("you@example.com");
  });

  it("preserves trailing Markdown and required-decorator normalization", () => {
    expect(normalizeHeader("## Idea [ optional ] * # : \t")).toBe("idea");
    expect(normalizeHeader("Idea ( required )\u00a0* : #\u2003")).toBe("idea");
    expect(normalizeHeader("Idea (required) * " + "#".repeat(100_000))).toBe("idea");
    expect(matched("## Email ###\nyou@example.com", "Email").text).toBe("you@example.com");
    expect(matched("**Email__ : \t\nyou@example.com", "Email").text).toBe("you@example.com");
    const numbered = "1. What are you building? ** \t\nA useful tool.\n\n2. Why this idea? __ \t\nWe needed it.";
    expect(matched(numbered, "What are you building?").text).toBe("A useful tool.");
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
