// dist/esm holds ES modules, but the package itself is CommonJS: this tells Node (and
// TypeScript) to read the files under dist/esm as ES modules.
import { writeFileSync } from "node:fs";

writeFileSync(new URL("../dist/esm/package.json", import.meta.url), `${JSON.stringify({ type: "module" }, null, 2)}\n`);
