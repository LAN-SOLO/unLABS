// Run Blender for the crystal pipeline: `pnpm crystal:blender` opens the GUI with
// the MCP bridge (scripts/crystal/mcp/bridge.py); `pnpm crystal:textures [--only a,b]`
// exports the bound library maps for the engine (headless).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MAC = "/Applications/Blender.app/Contents/MacOS/Blender";
const BIN = process.env.BLENDER || (existsSync(MAC) ? MAC : "blender");
const [mode = "gui", ...rest] = process.argv.slice(2);

if (mode === "gui") {
  const p = spawn(BIN, ["--python", join(ROOT, "scripts/crystal/mcp/bridge.py")], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
  });
  p.unref();
  console.log("Blender started with the crystal bridge (.crystal/bridge.json).");
} else if (mode === "textures") {
  const cli = join(ROOT, "scripts/crystal/blender/cli.py");
  const p = spawn(BIN, ["-b", "--factory-startup", "-P", cli, "--", "textures", ...rest], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "inherit"],
  });
  p.stdout.on("data", (d) => {
    for (const l of String(d).split("\n")) if (l.startsWith("[crystal]")) console.log(l.slice(10));
  });
  p.on("close", (code) => process.exit(code ?? 1));
} else {
  console.error("usage: node scripts/crystal/blender.mjs [gui|textures] …");
  process.exit(1);
}
