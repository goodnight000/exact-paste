import { spawnSync } from "node:child_process";
import { crc32 } from "node:zlib";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = spawnSync(process.execPath, [join(root, "scripts/build.mjs"), "--keyless"], { stdio: "inherit" });
if (built.status !== 0) process.exit(built.status ?? 1);

// Keep the archive portable without depending on a platform's zip executable.
const files = ["manifest.json", "content.js", "worker.js", "options.html", "options.js", "welcome.html", "welcome.js",
  ...(await readdir(join(root, "dist/icons"))).filter((name) => /^\d+\.png$/.test(name)).map((name) => `icons/${name}`)];
async function archive(prefix, filename) {
const local = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(`${prefix}${file}`);
  const data = await readFile(join(root, "dist", file));
  const crc = crc32(data) >>> 0;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6); header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, data);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(0x21, 14);
  entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += header.length + name.length + data.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(join(root, "release"), { recursive: true });
await writeFile(join(root, `release/${filename}`), Buffer.concat([...local, directory, end]));
}
await archive("exact-paste/", "exact-paste.zip");
await archive("", "exact-paste-store.zip");
console.log("Key-free extension: release/exact-paste.zip; Chrome Web Store upload: release/exact-paste-store.zip");
