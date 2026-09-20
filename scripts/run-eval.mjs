import { build } from "esbuild";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = "/tmp/exact-paste-eval.mjs";
await build({
  absWorkingDir: root,
  entryPoints: [join(root, "eval/run.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  legalComments: "none",
});
const child = spawn(process.execPath, [outfile], { cwd: root, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
