---
name: test-firestore-daos
description: Test code built on @schorts/firestore-admin-dao — unit-test application code against the kernel's InMemoryDAO through the DAO type, and integration-test FirestoreDAO subclasses against the Firestore emulator with a demo project, data reset between tests, entity registration, and suites that skip without the emulator. Use when adding tests for a Firestore DAO or for code that uses one.
---

# Test Firestore DAOs

Two layers (see [rules/testing.md](../../rules/testing.md)):

1. **Application code** depends on the kernel's `DAO<Model, Entity>` type. Test it with `InMemoryDAO`: fast, no Firestore.
2. **The `FirestoreDAO` subclass** (mapping, custom queries, transactions) runs against the Firestore emulator.

## 1. Depend on the `DAO` type

Code that only needs DAO methods should not name the Firestore class. Code that needs a custom query method or a Firestore unit of work keeps the concrete type and is covered by layer 2.

```ts
// file: tasks/task.ts
import { Entity } from "@schorts/shared-kernel/entities";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class TaskId extends UUIDValue {
  readonly attributeName = "taskId";
}

export type TaskModel = { id: string; title: string; done: boolean };

export class Task extends Entity<TaskId, TaskModel> {
  constructor(id: TaskId, public title = "", public done = false) {
    super(id);
  }

  toPrimitives(): TaskModel {
    return { id: this.id.value, title: this.title, done: this.done };
  }

  protected override createId(rawId: unknown): TaskId {
    return new TaskId(String(rawId));
  }

  protected override restoreFromPrimitives(data: TaskModel): void {
    this.title = data.title;
    this.done = data.done;
  }
}
```

```ts
// file: tasks/complete-task.ts
import type { DAO } from "@schorts/shared-kernel/dao";
import type { Task, TaskModel } from "./task.js";

export class TaskNotFound extends Error {
  override name = "TaskNotFound";
}

export async function completeTask(tasks: DAO<TaskModel, Task>, id: string): Promise<Task> {
  const task = await tasks.findByID(id);
  if (!task) throw new TaskNotFound(`Task ${id} does not exist`);

  task.done = true;
  return tasks.update(task);
}
```

```ts
// file: tasks/complete-task.test.ts
import { InMemoryDAO } from "@schorts/shared-kernel/dao";
import { completeTask, TaskNotFound } from "./complete-task.js";
import { Task, TaskId, type TaskModel } from "./task.js";

const id = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("completeTask", () => {
  it("marks the task as done", async () => {
    const tasks = new InMemoryDAO<TaskModel, Task>();
    await tasks.create(new Task(new TaskId(id), "Write docs"));

    await completeTask(tasks, id);

    expect((await tasks.findByID(id))?.done).toBe(true);
  });

  it("fails for a missing task", async () => {
    await expect(completeTask(new InMemoryDAO<TaskModel, Task>(), id)).rejects.toBeInstanceOf(TaskNotFound);
  });
});
```

`InMemoryDAO` is more permissive than Firestore (it supports `LIKE` and `BETWEEN`, needs no indexes, and allows reads after writes in a transaction). Anything that depends on those differences belongs in layer 2.

## 2. Run the emulator

Install the Firebase CLI, then start only Firestore:

```bash
firebase emulators:start --only firestore --project demo-test
```

Run the tests with the emulator address set. The Admin SDK connects to it, needs no credentials, and cannot reach a real project:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx jest
```

In CI, `firebase emulators:exec --only firestore --project demo-test "npx jest"` starts the emulator, runs the command, and stops it.

## 3. Write the integration test

- Use a `demo-` project ID.
- Delete all documents before each test through the emulator's REST endpoint.
- Register the entity in `beforeAll` and unregister it in `afterAll`.
- Skip the suite when `FIRESTORE_EMULATOR_HOST` is unset, so unit runs stay fast.
- Assert on the stored document too, not just on the round trip, when the mapping matters.

```ts
// file: tasks/task-dao.ts
import { FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { Criteria } from "@schorts/shared-kernel/criteria";
import type { Task, TaskModel } from "./task.js";

export const TASKS = "tasks";

export class TaskDAO extends FirestoreDAO<TaskModel, Task> {
  constructor(collection: CollectionReference) {
    super(collection);
  }

  findOpen(): Promise<Task[]> {
    return this.search(Criteria.none().where("done", "EQUAL", false));
  }
}
```

```ts
// file: tasks/task-dao.test.ts
import { EntityRegistry, getApps, getFirestore, initializeApp } from "@schorts/firestore-admin-dao";
import { Task, TaskId } from "./task.js";
import { TASKS, TaskDAO } from "./task-dao.js";

const host = process.env["FIRESTORE_EMULATOR_HOST"];
const projectId = "demo-test";
const describeWithEmulator = host ? describe : describe.skip;

async function clearFirestore(): Promise<void> {
  await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
}

describeWithEmulator("TaskDAO", () => {
  const firestore = getFirestore(getApps()[0] ?? initializeApp({ projectId }));
  const tasks = new TaskDAO(firestore.collection(TASKS));

  beforeAll(() => EntityRegistry.register(TASKS, Task));
  afterAll(() => EntityRegistry.unregister(TASKS));
  beforeEach(clearFirestore);

  it("stores the task without its id and reads it back", async () => {
    const id = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

    await tasks.create(new Task(new TaskId(id), "Write docs"));

    expect((await firestore.collection(TASKS).doc(id).get()).data()).toEqual({ title: "Write docs", done: false });
    expect((await tasks.findByID(id))?.title).toBe("Write docs");
  });

  it("finds only open tasks", async () => {
    await tasks.saveMany([
      new Task(new TaskId("5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e51"), "Open"),
      new Task(new TaskId("5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e52"), "Done", true),
    ]);

    expect((await tasks.findOpen()).map(task => task.title)).toEqual(["Open"]);
  });
});
```

## 4. Indexes

The emulator does not require composite indexes, so a query that works in tests can fail in production with `FAILED_PRECONDITION`. Keep `firestore.indexes.json` in the repository and review it with every new query, or run new queries once against a real test project.

## Checklist

- [ ] Application code typed against `DAO<Model, Entity>` and unit-tested with `InMemoryDAO`.
- [ ] Each `FirestoreDAO` subclass has an emulator suite covering the mapping and every custom query.
- [ ] Emulator suites use a `demo-` project, clear data before each test, and skip without `FIRESTORE_EMULATOR_HOST`.
- [ ] Entities registered in `beforeAll`, unregistered in `afterAll`.
