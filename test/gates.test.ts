import { describe, expect, it } from "vitest";
import { looksSecret, shapeOk } from "../src/gates";
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

  it("rejects an email in a name field", () => {
    expect(shapeOk(name, "marcus@anything.com")).toBe(false);
    expect(shapeOk(name, "Marcus Lowe")).toBe(true);
  });

  it("flags private keys as secret", () => {
    expect(looksSecret("hello world")).toBe(false);
    expect(looksSecret("-----BEGIN RSA PRIVATE KEY-----\nxx")).toBe(true);
  });
});
