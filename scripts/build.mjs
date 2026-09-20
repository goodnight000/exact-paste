import { crc32, deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { mkdir, writeFile, copyFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function loadEnv() {
  const out = { ...process.env };
  try {
    const text = readFileSync(join(root, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || match[1] === undefined) continue;
      let value = match[2] ?? "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      out[match[1]] = value;
    }
  } catch {
    // no .env file
  }
  return out;
}

function png(size, rgb) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const edge = x < size * 0.18 || y < size * 0.18 || x > size * 0.82 || y > size * 0.82;
      const [r, g, b] = edge ? [40, 40, 40] : rgb;
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }
  const chunk = (tag, data) => {
    const body = Buffer.concat([Buffer.from(tag), data]);
    const header = Buffer.alloc(4);
    header.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([header, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const env = loadEnv();
const key = (env.TYPESAFE_API_KEY ?? "").trim();
await mkdir(join(dist, "icons"), { recursive: true });
await writeFile(
  join(dist, "baked.js"),
  `export const BAKED_API_KEY = ${JSON.stringify(key)};\n`,
);

await build({
  absWorkingDir: root,
  entryPoints: [join(root, "extension/content.ts")],
  outfile: join(dist, "content.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  legalComments: "none",
});

await build({
  absWorkingDir: root,
  entryPoints: [join(root, "extension/worker.ts")],
  outfile: join(dist, "worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  legalComments: "none",
  plugins: [
    {
      name: "baked-key",
      setup(api) {
        api.onResolve({ filter: /(?:^|[./])baked(?:\.ts)?$/ }, () => ({
          path: join(dist, "baked.js"),
        }));
      },
    },
  ],
});
await unlink(join(dist, "baked.js")).catch(() => {});

await build({
  absWorkingDir: root,
  entryPoints: [join(root, "extension/options.ts")],
  outfile: join(dist, "options.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  legalComments: "none",
});

await copyFile(join(root, "extension/manifest.json"), join(dist, "manifest.json"));
await copyFile(join(root, "extension/options.html"), join(dist, "options.html"));

const fill = [232, 232, 232];
for (const size of [16, 32, 48, 128]) {
  await writeFile(join(dist, "icons", `${size}.png`), png(size, fill));
}

if (key) {
  console.log("Exact Paste: built with TYPESAFE_API_KEY from .env / environment.");
} else {
  console.log("Exact Paste: built without a key. Add TYPESAFE_API_KEY to .env and rebuild, or paste it in the extension popup.");
}
