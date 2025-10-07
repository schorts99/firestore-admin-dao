# 🔥 Firestore DAO

This module provides a type-safe, domain-driven abstraction over Firestore persistence. It integrates tightly with the `Model`, `Entity`, `Criteria` and `UnitOfWork` constructs from the [Shared Kernel](https://www.npmjs.com/package/@schorts/shared-kernel), enabling expressive, consistent, and testable data access across bounded contexts.

## 🚀 Installation

```bash
npm install --save @schorts/firestore-dao
```

## 🧩 Purpose

Firestore DAOs encapsulate all persistence logic for domain entities, including:

- 🔍 Querying by ID, criteria, or full collection.
- 🧠 Translating domain filters into Firestore constraints.
- 🧼 Formatting primitives for Firestore compatibility.
- 🔁 Coordinating writes via `FirestoreUnitOfWork` for atomicity.

They are not responsible for business logic, validation, or orchestration — only persistence.

## 🏗️ Architecture

Each DAO implements the following shared kernel interfaces:

- `Model<Entity>` - defines the contract for persistence operations.
- `Entity` - domain object with identity and behavior.
- `UnitOfWork` - optional batching mechanism for transactional consistency.

## 🧪 Example Usage

```ts
import { initializeApp, getFirestore, EntityRegistry } from "@schorts/firestore-dao";

// You need to use the internal firebase/firestore packages and register you entity via EntityRegistry

EntityRegistry.register("users", User);

const user = new User({ id: "abc123", name: "Alice" });

await userDAO.create(user); // direct write

const uow = new FirestoreUnitOfWork(firestore);
await userDAO.create(user, uow); // batched write
await uow.commit();
```

```ts
const found = await userDAO.findByID("abc123");
const results = await userDAO.search(Criteria.where("status", "EQUAL", "active"));
```

### Supports:

- Standard filters (`EQUAL`, `IN`, `GREATER_THAN`, etc.)
- Geo-radius queries with post-filtering via `distanceBetween`.
- Ordering, limits, and pagination (`startAfter`).

## 🚧 Future Extensions

- Soft deletes via `status: "deleted"`.

## 🧠 Philosophy

This layer reflects a commitment to:

- Domain-driven design.
- Type safety and semantic clarity.
- Separation of concerns.
- Scalable, testable architecture.
