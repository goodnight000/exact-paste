import { describe, expect, it, vi } from "vitest";
import { decide } from "../src/decide";
import type { FieldInfo, JevAnswers, JevAsk } from "../src/types";

const resume = `Marcus Lowe
Co-founder & CEO
marcus@anything.com
https://x.com/marcus_lowe
San Francisco, CA
Skydive
`;

const emailField: FieldInfo = {
  label: "Email address",
  kind: "email",
  type: "email",
  name: "email",
  id: "email",
  autocomplete: "email",
  placeholder: "",
  tag: "input",
  nearby: ["Full name"],
};

const nameField: FieldInfo = {
  label: "Full name",
  kind: "text",
  type: "text",
  name: "name",
  id: "name",
  autocomplete: "name",
  placeholder: "",
  tag: "input",
  nearby: ["Email address"],
};

function askWith(answers: JevAnswers): JevAsk {
  return vi.fn(async () => answers);
}

describe("decide", () => {
  it("pastes the only email into an email field without calling Jev", async () => {
    const ask = askWith({});
    const result = await decide(resume, emailField, ask);
    expect(result).toEqual({
      value: "marcus@anything.com",
      mode: "slice",
      reason: "one-email",
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it("pastes the whole chunk when the clipboard looks secret", async () => {
    const ask = askWith({});
    const secret = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
    const result = await decide(secret, emailField, ask);
    expect(result.mode).toBe("whole");
    expect(result.value).toBe(secret);
    expect(ask).not.toHaveBeenCalled();
  });

  it("pastes the whole chunk when Jev is unsure", async () => {
    const ask = askWith({
      wants_extracted: { type: "noul", noul: 0.4 },
      pick: {
        type: "choice",
        choice: "c0",
        probabilities: { none: 0.3, whole: 0.3, c0: 0.4 },
        confidence: 0.2,
      },
    });
    const result = await decide(resume, nameField, ask);
    expect(result).toMatchObject({ value: resume, mode: "whole" });
  });

  it("pastes an exact name when Jev picks and verifies it", async () => {
    const clipboard = "Marcus Lowe\nSkydive\n";
    const ask: JevAsk = async (_state, questions) => {
      if ("ok" in questions) {
        const answers: JevAnswers = { ok: { type: "noul", noul: 0.96 } };
        return answers;
      }
      const criteria = (questions.pick as { criteria: Record<string, string> }).criteria;
      const id = Object.keys(criteria).find((key) => criteria[key] === "Marcus Lowe");
      if (!id) throw new Error("missing name candidate");
      const answers: JevAnswers = {
        wants_extracted: { type: "noul", noul: 0.94 },
        pick: {
          type: "choice",
          choice: id,
          probabilities: { none: 0.02, whole: 0.04, [id]: 0.94 },
          confidence: 0.9,
        },
      };
      return answers;
    };
    const result = await decide(clipboard, nameField, ask);
    expect(result).toEqual({ value: "Marcus Lowe", mode: "slice", reason: "jev-pick" });
  });

  it("falls back to the whole chunk if Jev throws", async () => {
    const ask: JevAsk = async () => {
      throw new Error("network");
    };
    const result = await decide(resume, nameField, ask);
    expect(result).toEqual({ value: resume, mode: "whole", reason: "jev-error" });
  });

  it("rejects a pick that is not a substring", async () => {
    const ask: JevAsk = async () => ({
      wants_extracted: { type: "noul", noul: 0.99 },
      pick: {
        type: "choice",
        choice: "invented",
        probabilities: { none: 0, whole: 0, invented: 1 },
        confidence: 1,
      },
    });
    const result = await decide(resume, nameField, ask);
    expect(result.mode).toBe("whole");
  });
});
