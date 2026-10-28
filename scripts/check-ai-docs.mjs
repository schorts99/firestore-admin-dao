// Type-checks every ```ts block in ai/ against this package's source.
//
// A block that starts with `// file: <path>` is written to that path inside its document's
// folder, so blocks of one document can import each other. Other blocks become standalone
// snippets. Blocks fenced as ```ts no-check are skipped.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "ai");
const outDir = join(root, ".ai-docs-check");

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith(".md") ? [path] : [];
  });
}

rmSync(outDir, { recursive: true, force: true });

let blocks = 0;

for (const doc of markdownFiles(docsDir)) {
  const docOut = join(outDir, relative(docsDir, doc).replace(/\.md$/, "").replace(/[\\/]/g, "__"));
  const fence = /^```ts([^\n]*)\n([\s\S]*?)^```$/gm;
  let match;
  let snippet = 0;

  while ((match = fence.exec(readFileSync(doc, "utf8")))) {
    if (match[1].includes("no-check")) continue;

    const code = match[2];
    const file = /^\/\/ file: (\S+)/.exec(code)?.[1] ?? `snippet-${++snippet}.ts`;
    const target = join(docOut, file);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, code);
    blocks++;
  }
}

writeFileSync(
  join(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "es2022",
        module: "nodenext",
        moduleResolution: "nodenext",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        isolatedModules: true,
        types: ["jest", "node"],
        paths: { "@schorts/firestore-admin-dao": [join(root, "src/index.ts")] },
      },
      include: ["**/*.ts"],
    },
    null,
    2,
  ),
);

try {
  execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", join(outDir, "tsconfig.json")], { stdio: "inherit" });
  console.log(`Type-checked ${blocks} TypeScript blocks in ai/.`);
} catch {
  console.error(`Type errors in ai/ examples. Generated files are in ${relative(root, outDir)}/.`);
  process.exit(1);
}
