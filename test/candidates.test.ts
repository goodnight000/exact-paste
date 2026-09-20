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
});
