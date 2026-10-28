# @schorts/firestore-admin-dao

[![npm version](https://badge.fury.io/js/%40schorts%2Ffirestore-admin-dao.svg)](https://badge.fury.io/js/%40schorts%2Ffirestore-admin-dao)

This module provides a type-safe, domain-driven abstraction over Firestore persistence. It integrates tightly with the `Model`, `Entity`, `Criteria` and `UnitOfWork` constructs from `@schorts/shared-kernel`, enabling expressive, consistent, and testable data access.

## 🤖 Using it with AI coding agents

The package ships agent docs in `node_modules/@schorts/firestore-admin-dao/ai/`: an `AGENTS.md` overview, rules (entity mapping, querying, transactions, soft delete, testing), and step-by-step skills (create a DAO, geo search, transactions and batches, soft delete, testing, upgrading to 6.x) with type-checked examples. They build on the shared kernel's docs. Point your agent at both, for example in `CLAUDE.md`:

```md no-check
Before writing code that uses @schorts/firestore-admin-dao, read
node_modules/@schorts/shared-kernel/ai/AGENTS.md, then
node_modules/@schorts/firestore-admin-dao/ai/AGENTS.md, and follow their rules and skills.
```

[`ai/README.md`](ai/README.md) has setup for Claude Code (including linking the skills), Cursor, Copilot, and other tools.

## Installation

This package has a peer dependency on `@schorts/shared-kernel` 11.x and requires Node.js 22 or later (a requirement of `firebase-admin` 14).

```bash
npm install @schorts/firestore-admin-dao @schorts/shared-kernel
```

It works from both ES modules and CommonJS.

## Usage

Here's a complete example of how to use the `FirestoreDAO` to interact with a collection.

### 1. Initialize Firebase Admin

With no arguments, `initializeApp()` uses Application Default Credentials, or the Firestore emulator when `FIRESTORE_EMULATOR_HOST` is set. Pass `credential: cert(serviceAccount)` to use a service account key instead.

```ts
// file: firebase.ts
import { getApps, getFirestore, initializeApp } from "@schorts/firestore-admin-dao";

const app = getApps()[0] ?? initializeApp();

export const firestore = getFirestore(app);
```

### 2. Define your entity

An entity extends the kernel's `Entity` and implements `toPrimitives()`. `createId` and `restoreFromPrimitives` let the kernel rebuild it from a stored document.

- The document is `toPrimitives()` without `id`; the document ID is the entity ID.
- `Date` and `DateValue` properties are stored as Firestore `Timestamp`s, under the property name in snake_case (`createdAt` → `created_at`). Name the model field the same way. They come back as ISO strings.

```ts
// file: task.ts
import { Entity } from "@schorts/shared-kernel/entities";
import { DateValue, UUIDValue } from "@schorts/shared-kernel/value-objects";

export class TaskId extends UUIDValue {
  readonly attributeName = "taskId";
}

export class CreatedAt extends DateValue {
  readonly attributeName = "createdAt";
}

export type TaskModel = {
  id: string;
  title: string;
  priority: number;
  done: boolean;
  created_at: string;
};

export class Task extends Entity<TaskId, TaskModel> {
  constructor(
    id: TaskId,
    public title = "",
    public priority = 0,
    public done = false,
    public createdAt = new CreatedAt(new Date()),
  ) {
    super(id);
  }

  toPrimitives(): TaskModel {
    return {
      id: this.id.value,
      title: this.title,
      priority: this.priority,
      done: this.done,
      created_at: this.createdAt.value.toISOString(),
    };
  }

  protected override createId(rawId: unknown): TaskId {
    return new TaskId(String(rawId));
  }

  protected override restoreFromPrimitives(data: TaskModel): void {
    this.title = data.title;
    this.priority = data.priority;
    this.done = data.done;
    this.createdAt = new CreatedAt(new Date(data.created_at));
  }
}
```

### 3. Create a concrete DAO class

`FirestoreDAO` is abstract. Extend it with your collection and register the entity under the collection's path, so the DAO can rebuild entities when it reads.

```ts
// file: task-dao.ts
import { EntityRegistry, FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { Criteria } from "@schorts/shared-kernel/criteria";
import { Task, type TaskModel } from "./task.js";

export const TASKS = "tasks";

EntityRegistry.register(TASKS, Task);

export class TaskDAO extends FirestoreDAO<TaskModel, Task> {
  constructor(collection: CollectionReference) {
    // "HARD" removes deleted documents; "SOFT" flags them so they can be restored.
    super(collection, "HARD");
  }

  findOpenByPriority(limit = 20): Promise<Task[]> {
    return this.search(
      Criteria.none()
        .where("done", "EQUAL", false)
        .orderBy("priority", "DESC")
        .limitResults(limit),
    );
  }
}
```

### 4. Use the DAO

```ts
// file: main.ts
import { randomUUID } from "node:crypto";
import { Criteria } from "@schorts/shared-kernel/criteria";
import { firestore } from "./firebase.js";
import { Task, TaskId } from "./task.js";
import { TASKS, TaskDAO } from "./task-dao.js";

const tasks = new TaskDAO(firestore.collection(TASKS));

// Create
const task = new Task(new TaskId(randomUUID()), "Write the release notes", 2);
await tasks.create(task);

// Read
const found = await tasks.findByID(task.id.value);
const urgent = await tasks.search(
  Criteria.none().where("priority", "GREATER_THAN_OR_EQUAL", 2).orderBy("priority", "DESC"),
);
const open = await tasks.findOpenByPriority();
const total = await tasks.count();

// Update
if (found) {
  found.done = true;
  await tasks.update(found);
}

// Delete
await tasks.delete(task);

console.log({ urgent: urgent.length, open: open.length, total });
```

Every method also takes an optional unit of work to group writes. Use `FirestoreUnitOfWorkRunner` for transactions and `FirestoreBatchUnitOfWork` for batched writes.

Supported `Criteria` operators are `EQUAL`, `NOT_EQUAL`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`, `IN`, `NOT_IN`, `ARRAY_CONTAINS`, `ARRAY_CONTAINS_ANY`, and `GEO_RADIUS`. `LIKE` and `BETWEEN` throw `OperatorNotValid`.

The [`ai/`](ai/AGENTS.md) docs cover entity mapping, querying and indexes, geo search, transactions and batches, soft delete, and testing in detail.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the LGPL-3.0-or-later License.
