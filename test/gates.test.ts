import { describe, expect, it } from "vitest";
import { EMAIL_RE, isEmail, isUrl, lead, looksSecret, platformUrlOk, shapeOk, uniqueMatches, uniqueUrls } from "../src/gates";
import { field } from "../eval/fields";
import type { FieldInfo } from "../src/types";

const email: FieldInfo = {
  label: "Email",
  kind: "email",
  type: "email",
  name: "",
  id: "",
  autocomplete: "",
  placeholder: "",
  tag: "input",
  nearby: [],
};

const name: FieldInfo = {
  label: "Full name",
  kind: "text",
  type: "text",
  name: "",
  id: "",
  autocomplete: "name",
  placeholder: "",
  tag: "input",
  nearby: [],
};

describe("gates", () => {
  it("rejects a sentence in an email field", () => {
    expect(shapeOk(email, "reach me at marcus@anything.com please")).toBe(false);
    expect(shapeOk(email, "marcus@anything.com")).toBe(true);
  });

  it("does not treat money as a URL", () => {
    expect(isUrl("1240.00")).toBe(false);
    expect(isUrl("nia.audio")).toBe(true);
    expect(isUrl("https://nia.audio")).toBe(true);
  });

  it("rejects an email in a name field", () => {
    expect(shapeOk(name, "marcus@anything.com")).toBe(false);
    expect(shapeOk(name, "Marcus Lowe")).toBe(true);
  });

  it("flags private keys as secret", () => {
    expect(looksSecret("hello world")).toBe(false);
    expect(looksSecret("-----BEGIN RSA PRIVATE KEY-----\nxx")).toBe(true);
  });

  it("strips unmatched surrounding URL punctuation but preserves balanced paths", () => {
    expect(uniqueUrls("[https://example.com] (https://example.com/a_(b))")).toEqual(["https://example.com", "https://example.com/a_(b)"]);
  });

  it("does not erase independent URLs that share a prefix", () => {
    expect(uniqueUrls("https://linkedin.com/in/alice\nhttps://linkedin.com/in/alice2")).toEqual(["https://linkedin.com/in/alice", "https://linkedin.com/in/alice2"]);
    expect(uniqueUrls("me@example.com\nhttps://example.com/path")).toEqual(["https://example.com/path"]);
  });

  it("handles a very long run of unmatched URL punctuation", () => {
    expect(uniqueUrls("https://example.com/path" + ")".repeat(50_000))).toEqual(["https://example.com/path"]);
  });

  it("validates actual URL authorities and platform domains", () => {
    expect(isUrl("https://")).toBe(false);
    expect(isUrl("https://user:password@example.com")).toBe(false);
    expect(isUrl("javascript:alert(1)")).toBe(false);
    expect(platformUrlOk(field("LinkedIn", "url"), "https://www.linkedin.com/in/me")).toBe(true);
    expect(platformUrlOk(field("LinkedIn", "url"), "https://linkedin.com.evil.example/in/me")).toBe(false);
    expect(shapeOk(field("GitHub profile", "url"), "https://linkedin.com/in/me")).toBe(false);
  });

  it("does not force platform URL shapes on essay questions mentioning a platform", () => {
    expect(shapeOk(field("What have you learned from GitHub?", "textarea"), "Ship useful tools.", { exactHeader: true })).toBe(true);
  });

  it("validates practical email syntax without treating a label as the local part", () => {
    expect(isEmail("Email:me@example.com")).toBe(false);
    expect(isEmail("me@example.com")).toBe(true);
    expect(isEmail("zoë+work@example.com")).toBe(true);
    expect(isEmail("..me@example.com")).toBe(false);
  });

  it("does not scan huge invalid tokens quadratically or extract a suffix", () => {
    expect(uniqueMatches("a".repeat(500_000), EMAIL_RE)).toEqual([]);
    expect(uniqueMatches("a".repeat(500_000) + "@example.com", EMAIL_RE)).toEqual([]);
    expect(uniqueUrls("a-".repeat(100_000) + ".com")).toEqual([]);
    expect(uniqueMatches("Email: me@example.com.", EMAIL_RE)).toEqual(["me@example.com"]);
    expect(uniqueUrls("Visit example.com.")).toEqual(["example.com"]);
  });

  it("permits exact long answers without relaxing uncertain model shape gates", () => {
    const long = "a".repeat(20_000);
    expect(shapeOk(field("Describe your idea", "textarea"), long)).toBe(false);
    expect(shapeOk(field("Describe your idea", "textarea"), long, { exactHeader: true })).toBe(true);
    expect(shapeOk(field("Custom answer", "text"), "a\nb", { exactHeader: true })).toBe(false);
  });

  it("fails closed for malformed probability maps", () => {
    expect(lead(null as unknown as Record<string, number>, "pick")).toBe(0);
    expect(lead({ pick: NaN }, "pick")).toBe(0);
    expect(lead({ pick: 2, none: -1 }, "pick")).toBe(0);
    expect(lead({ other: 1 }, "pick")).toBe(0);
    expect(lead({ pick: 0.9, none: 0.1 }, "pick")).toBeCloseTo(0.8);
  });

  it("recognizes labelled credentials and bearer tokens", () => {
    expect(looksSecret('"api_key": "secret-value-123456"')).toBe(true);
    expect(looksSecret("Authorization: Bearer verylongsecretvalue123456")).toBe(true);
    expect(looksSecret("The password manager makes setup easy.")).toBe(false);
    expect(looksSecret("https://user:password@example.com/path")).toBe(true);
    expect(uniqueMatches("https://linkedin.com@evil.example/path", EMAIL_RE)).toEqual([]);
  });
});
