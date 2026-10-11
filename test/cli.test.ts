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

// Real terminal paste is delivered as one chunk, not one event per key.
describe('optional key input', () => {
  it('accepts a pasted chunk and masks it', async () => {
    const { PassThrough } = await import('node:stream');
    const { hidden } = await import('../scripts/setup-key.mjs');
    const input = new PassThrough() as import('node:stream').PassThrough & { isTTY: boolean; setRawMode: () => void };
    input.isTTY = true; input.setRawMode = () => {};
    const output = new PassThrough(); let shown = ''; output.on('data', (chunk) => { shown += String(chunk); });
    const result = hidden('Key: ', input as never, output as never);
    input.write('\u001b[200~fake-key-for-test\u001b[201~\r');
    expect(await result).toBe('fake-key-for-test'); expect(shown).not.toContain('fake-key-for-test');
  });
  it('fails promptly on noninteractive EOF', async () => {
    const { PassThrough } = await import('node:stream');
    const { hidden } = await import('../scripts/setup-key.mjs');
    const input = new PassThrough(); const output = new PassThrough();
    const result = hidden('Key: ', input as never, output as never); input.end();
    await expect(result).rejects.toThrow('No input');
  });
});
