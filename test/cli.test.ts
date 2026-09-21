import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("exact-paste CLI", () => {
  it("prints help", () => {
    const result = spawnSync(process.execPath, ["bin/exact-paste.mjs", "--help"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("TypeSafe");
    expect(result.stdout).toContain("npm start");
  });
});
