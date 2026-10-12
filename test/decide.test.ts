import { describe, expect, it, vi } from "vitest";
import { decide } from "../src/decide";
import { field } from "../eval/fields";
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
  it("does not interpret words inside essay questions as name slots", async () => {
    for (const target of [field("Describe the first name you chose for your product", "textarea"),
      field("Describe your issue", "textarea", {name:"first_name",autocomplete:"given-name"})]) {
      expect(await decide("Maya Chen", target, null)).toMatchObject({mode:"whole",value:"Maya Chen"});
    }
  });
  it("requires review for a literal header inside introductory prose", async () => {
    const text="Here is an example, not my biography:\n\nBio: example answer";
    expect(await decide(text,field("Bio","textarea"),null)).toMatchObject({mode:"slice",reason:"template-suggestion"});
  });
  it("does not extract an order ID as a phone or a full phone as a country code", async () => {
    expect((await decide("Your order number is 1234567890",field("Phone","tel"),null)).mode).toBe("whole");
    const target=field("Country calling code","tel",{autocomplete:"tel-country-code"});
    expect((await decide("Contact +1 415 555 0100",target,null)).mode).toBe("whole");
    expect(await decide("Country calling code: +1",target,null)).toMatchObject({value:"+1",mode:"slice"});
  });
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

  it("still slices an email when the same chunk contains a card-shaped number", async () => {
    const ask = askWith({});
    const mixed = "marcus@anything.com\ncard 4242424242424242";
    const result = await decide(mixed, emailField, ask);
    expect(result).toMatchObject({ value: "marcus@anything.com", mode: "slice" });
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

  it("extracts complete long template answers locally from the full clipboard", async () => {
    const answer = "Our thesis: make time useful.\r\n".repeat(600).trimEnd();
    const clipboard = "Old notes\n".repeat(2000) + `\r\n# What are you building?\r\n${answer}\r\n\r\n# Who needs it most?\r\nClinics.`;
    const ask = askWith({});
    expect(await decide(clipboard, field("What are you building?", "textarea"), ask)).toEqual({ value: answer, mode: "slice", reason: "template-suggestion" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("handles an email label directly adjacent to its value", async () => {
    const ask = askWith({});
    expect(await decide("Email:me@example.com", emailField, ask)).toMatchObject({ value: "me@example.com", mode: "slice" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("does not choose an unrelated or spoofed URL for a platform field", async () => {
    const ask = askWith({});
    for (const clipboard of ["https://github.com/me", "Website: https://company.example", "https://linkedin.com.evil.example/in/me", "https://linkedin.com@evil.example/in/me"]) {
      const result = await decide(clipboard, field("LinkedIn", "url"), ask);
      expect(result.mode, clipboard).toBe("whole");
      expect(result.value).toBe(clipboard);
    }
    expect(ask).not.toHaveBeenCalled();
  });

  it.each([
    ["Personal email: me@example.com", field("Work email", "email")],
    ["Company website: https://company.example", field("Personal website", "url")],
    ["Home phone: +1 415 555 0100", field("Work phone", "tel")],
  ])("does not bypass incompatible explicit headers with a lone scalar: %s", async (clipboard, target) => {
    const ask = askWith({});
    expect(await decide(clipboard, target, ask)).toMatchObject({ value: clipboard, mode: "whole", reason: "template-mismatch" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("chooses the sole relevant platform URL among several other URLs locally", async () => {
    const ask = askWith({});
    const clipboard = "https://github.com/me\nhttps://www.linkedin.com/in/me\nhttps://me.example";
    expect(await decide(clipboard, field("LinkedIn", "url"), ask)).toEqual({ value: "https://www.linkedin.com/in/me", mode: "slice", reason: "one-platform-url" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("rejects two possible platform URLs rather than asking for a guess", async () => {
    const ask = askWith({});
    const clipboard = "https://linkedin.com/in/first\nhttps://linkedin.com/in/second";
    expect(await decide(clipboard, field("LinkedIn", "url"), ask)).toMatchObject({ value: clipboard, mode: "whole", reason: "ambiguous-platform-urls" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("keeps platform URLs with shared prefixes ambiguous", async () => {
    const clipboard = "Alice: https://linkedin.com/in/alice\nAlice Two: https://linkedin.com/in/alice2";
    const ask = askWith({});
    expect(await decide(clipboard, field("LinkedIn", "url"), ask)).toMatchObject({ value: clipboard, mode: "whole", reason: "ambiguous-platform-urls" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("rejects conflicting headers before any heuristic or model can choose one", async () => {
    const ask = askWith({});
    const clipboard = "Email: first@example.com\nEmail address: second@example.com";
    expect(await decide(clipboard, emailField, ask)).toMatchObject({ value: clipboard, mode: "whole", reason: "ambiguous-template-conflicting-headers" });
    const names = "Name: Jane Doe\nName: John Smith";
    expect(await decide(names, field("First name", "text", { autocomplete: "given-name" }), ask)).toMatchObject({ value: names, mode: "whole", reason: "ambiguous-template-conflicting-headers" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("never submits a truncated ambiguous source to Jev", async () => {
    const ask = askWith({});
    const clipboard = "ambiguous notes ".repeat(1200) + "\nMarcus Lowe\nSkydive";
    expect(await decide(clipboard, nameField, ask)).toEqual({ value: clipboard, mode: "whole", reason: "source-too-large" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("keeps labelled secrets away from Jev", async () => {
    const ask = askWith({});
    const clipboard = 'api_key: "a-very-long-sensitive-value"\nuncertain prose';
    expect(await decide(clipboard, field("Explain your idea", "textarea"), ask)).toMatchObject({ value: clipboard, mode: "whole", reason: "secret" });
    expect(ask).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -0.1, 1.1])("rejects a non-probability noul value %s", async (noul) => {
    const ask = askWith({ wants_extracted: { type: "noul", noul } });
    const clipboard = "Marcus Lowe\nSkydive\n";
    expect(await decide(clipboard, nameField, ask)).toMatchObject({ value: clipboard, mode: "whole", reason: "not-extracted" });
  });

  it.each([
    { confidence: NaN, probabilities: { n0: 1 } },
    { confidence: Infinity, probabilities: { n0: 1 } },
    { confidence: 2, probabilities: { n0: 1 } },
    { confidence: 1, probabilities: undefined },
    { confidence: 1, probabilities: null },
    { confidence: 1, probabilities: { n0: NaN } },
    { confidence: 1, probabilities: { n0: 2 } },
    { confidence: 1, probabilities: { n0: 1, none: -1 } },
  ])("handles malformed choice data without throwing: %j", async (data) => {
    const ask = askWith({
      wants_extracted: { type: "noul", noul: 0.99 },
      pick: { type: "choice", choice: "n0", ...data },
    } as unknown as JevAnswers);
    const clipboard = "Marcus Lowe\nSkydive\n";
    await expect(decide(clipboard, nameField, ask)).resolves.toMatchObject({ value: clipboard, mode: "whole", reason: "no-pick" });
  });

  it("retains the second model verification and rejects an invalid verifier score", async () => {
    const clipboard = "Marcus Lowe\nSkydive\n";
    const ask = vi.fn<JevAsk>(async (_state, questions): Promise<JevAnswers> => {
      if ("ok" in questions) return { ok: { type: "noul", noul: 2 } };
      const criteria = (questions.pick as { criteria: Record<string, string> }).criteria;
      const id = Object.keys(criteria).find((key) => criteria[key] === "Marcus Lowe")!;
      return {
        wants_extracted: { type: "noul", noul: 0.99 },
        pick: { type: "choice", choice: id, probabilities: { [id]: 0.99, whole: 0.01 }, confidence: 0.99 },
      };
    });
    expect(await decide(clipboard, nameField, ask)).toEqual({ value: clipboard, mode: "whole", reason: "verify-fail" });
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
