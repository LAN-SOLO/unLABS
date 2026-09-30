// vite-node config for the audio scripts: `@` → repo root.
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const config = { root, resolve: { alias: { "@": root } }, logLevel: "warn" };
export default config;
