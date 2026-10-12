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

function png(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      // The I-beam mark matches Settings. Supersampling keeps toolbar sizes clear.
      let alpha = 0, ink = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const u = (x + (sx + 0.5) / 4) / size, v = (y + (sy + 0.5) / 4) / size;
        const dx = Math.max(0, Math.abs(u - 0.5) - 0.255), dy = Math.max(0, Math.abs(v - 0.5) - 0.255);
        if (dx * dx + dy * dy > 0.12 * 0.12) continue;
        alpha++;
        if ((Math.abs(u - 0.5) < 0.035 && v > 0.28 && v < 0.72) ||
          (u > 0.375 && u < 0.625 && (Math.abs(v - 0.28) < 0.035 || Math.abs(v - 0.72) < 0.035))) ink++;
      }
      const tone = alpha ? Math.round(32 + 210 * ink / alpha) : 0;
      raw[offset++] = tone; raw[offset++] = tone; raw[offset++] = tone;
      raw[offset++] = Math.round(255 * alpha / 16);
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
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const env = process.argv.includes("--with-key") && !process.argv.includes("--keyless") ? loadEnv() : {};
const key = process.argv.includes("--with-key") && !process.argv.includes("--keyless")
  ? (env.TYPESAFE_API_KEY ?? "").trim() : "";
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
await build({
  absWorkingDir: root,
  entryPoints: [join(root, "extension/welcome.ts")],
  outfile: join(dist, "welcome.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  legalComments: "none",
});
await copyFile(join(root, "extension/welcome.html"), join(dist, "welcome.html"));

for (const size of [16, 32, 48, 128]) {
  await writeFile(join(dist, "icons", `${size}.png`), png(size));
}

if (key) {
  console.log("Exact Paste: built with TYPESAFE_API_KEY from .env / environment.");
} else {
  console.log("Exact Paste: built without a key. Local matching is ready; optionally add a TypeSafe key in Settings.");
}
