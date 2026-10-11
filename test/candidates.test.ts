import { describe, expect, it } from "vitest";
import { candidates } from "../src/candidates";

const resume = `Marcus Lowe
Co-founder & CEO
marcus@anything.com
https://skydive.com
https://x.com/marcus_lowe
San Francisco, CA

PROFILE
Product-minded technology founder building AI systems.

EXPERIENCE
Skydive
`;

describe("candidates", () => {
  it("always includes the whole clipboard", () => {
    const found = candidates(resume);
    expect(found.at(-1)).toMatchObject({ id: "whole", text: resume });
  });

  it("finds emails, urls, and labelled city-like lines as exact slices", () => {
    const found = candidates(resume);
    const texts = found.map((item) => item.text);
    expect(texts).toContain("marcus@anything.com");
    expect(texts).toContain("https://skydive.com");
    expect(texts).toContain("https://x.com/marcus_lowe");
    expect(texts).toContain("San Francisco, CA");
    for (const item of found) {
      expect(resume.slice(item.start, item.end)).toBe(item.text);
    }
  });

  it("keeps multiline header answers as complete candidates with original offsets", () => {
    const answer = "A useful tool.\r\nThe reason: clinics need it.\r\n\r\nIt saves hours.";
    const source = `## What are you building?\r\n${answer}\r\n\r\n## Who needs it most?\r\nClinics.`;
    const found = candidates(source);
    expect(found.some((candidate) => candidate.text === answer)).toBe(true);
    for (const candidate of found) expect(source.slice(candidate.start, candidate.end)).toBe(candidate.text);
  });

  it("does not silently exclude URL candidates after the former prefix limit", () => {
    const source = "ordinary notes ".repeat(1000) + "\nhttps://late.example/path";
    expect(candidates(source).some((candidate) => candidate.text === "https://late.example/path")).toBe(true);
  });
});
