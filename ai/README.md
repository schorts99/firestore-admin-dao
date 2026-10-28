# AI agent docs for `@schorts/firestore-admin-dao`

These files teach AI coding agents (Claude Code, Cursor, GitHub Copilot, Codex, and others) how to use this package correctly in **your** project. They ship inside the npm package, so they always match the installed version.

```
node_modules/@schorts/firestore-admin-dao/ai/
├── AGENTS.md   Overview, imports, and the rules that matter most. Start here.
├── rules/      Short, always-on conventions per area.
└── skills/     Step-by-step workflows for common tasks, with complete examples.
```

They build on the shared kernel's docs in `node_modules/@schorts/shared-kernel/ai/`, which cover entities, value objects, criteria, and DAOs in general. Set up both.

Every TypeScript example is type-checked against the package source before each release (`npm run check:ai-docs`).

## Set it up

Pick the option for your tool. Each one points the agent at the installed copy, so upgrading the package upgrades the docs.

### Claude Code

Add a pointer to your project's `CLAUDE.md`:

```md no-check
## @schorts/firestore-admin-dao
Before writing code that uses @schorts/firestore-admin-dao, read
node_modules/@schorts/shared-kernel/ai/AGENTS.md, then
node_modules/@schorts/firestore-admin-dao/ai/AGENTS.md, and follow their rules.
For a task they list, follow the matching skill in their skills/ folders.
```

To make the skills show up as Claude Code skills, link them into your project:

```bash
mkdir -p .claude/skills
for skill in node_modules/@schorts/firestore-admin-dao/ai/skills/*/; do
  ln -sfn "../../$skill" ".claude/skills/firestore-admin-dao-$(basename "$skill")"
done
```

### Cursor

Create `.cursor/rules/firestore-admin-dao.mdc`:

```md no-check
---
description: Persisting @schorts/shared-kernel entities in Firestore with @schorts/firestore-admin-dao
globs: ["**/*.ts"]
alwaysApply: false
---
Read node_modules/@schorts/firestore-admin-dao/ai/AGENTS.md and the rule files it links before
writing code that imports @schorts/firestore-admin-dao. For a task it lists, follow the matching
skill in node_modules/@schorts/firestore-admin-dao/ai/skills/.
```

### GitHub Copilot, Codex, and other `AGENTS.md`-aware tools

Add the same pointer to `.github/copilot-instructions.md` or your root `AGENTS.md`:

```md no-check
When code imports @schorts/firestore-admin-dao, follow
node_modules/@schorts/firestore-admin-dao/ai/AGENTS.md and the rules and skills it links.
```

### Copying instead of linking

If your tool cannot read `node_modules`, copy the folder into the repository and refresh it when you upgrade:

```bash
rm -rf docs/ai/firestore-admin-dao && cp -R node_modules/@schorts/firestore-admin-dao/ai docs/ai/firestore-admin-dao
```
