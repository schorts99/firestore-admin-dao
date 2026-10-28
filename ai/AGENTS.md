# Using `@schorts/firestore-admin-dao`

Firestore persistence for `@schorts/shared-kernel` on the server (Firebase Admin SDK): `FirestoreDAO` stores kernel `Entity` subclasses in a collection and answers kernel `Criteria` queries; `FirestoreUnitOfWorkRunner` and `FirestoreBatchUnitOfWork` group writes; `DataMigrator` prepares collections for soft delete.

This package builds on the shared kernel. Read `node_modules/@schorts/shared-kernel/ai/AGENTS.md` for entities, value objects, criteria, and DAOs in general, then this file for what changes on Firestore. Read the rule file for the area you are touching, and follow the matching skill when the task is one of those listed below.

## Imports

Everything comes from the package root:

```ts
import {
  FirestoreDAO,
  FirestoreUnitOfWorkRunner,
  FirestoreBatchUnitOfWork,
  DataMigrator,
  OperatorNotValid,
  EntityRegistry,
  initializeApp,
  getApps,
  getFirestore,
  cert,
  Timestamp,
  type CollectionReference,
} from "@schorts/firestore-admin-dao";
```

- `initializeApp`, `getApps`, `cert`, `getFirestore`, `Firestore`, `Timestamp`, `getAuth`, and `EntityRegistry` are re-exports, so one import covers setup. They are the same objects as in `firebase-admin` and `@schorts/shared-kernel`.
- Kernel types (`Criteria`, `Entity`, `Logger`, value objects) come from `@schorts/shared-kernel` subpaths as usual.
- This is server-only code (Firebase Admin). Never import it from browser code.

## Rules that matter most

1. **One DAO per collection.** Subclass `FirestoreDAO<Model, Entity>` and pass a `CollectionReference`, a delete mode (`"HARD"` or `"SOFT"`), and optionally a `Logger`.
2. **Register the entity under the collection path before reading.** The DAO rebuilds entities with `EntityRegistry.fromPrimitives(collection.path, …)`. For subcollections the path includes the parent (`orgs/o1/members`), so register per path.
3. **The document is `toPrimitives()` without `id`; the document ID is the entity ID.** On write, entity properties that are `Date`/`DateValue` become `Timestamp`s and `CoordinatesValue`s add a `<field>_geohash` field, keyed by the property name in snake_case (a leading `_` is dropped). Name those properties so that key matches the model field. On read, top-level `Timestamp`s become ISO strings, so `fromPrimitives` must accept strings.
4. **Criteria fields are stored field names; `id` means the document ID.** Supported: `EQUAL`, `NOT_EQUAL`, the four range operators, `IN`, `NOT_IN`, `ARRAY_CONTAINS`, `ARRAY_CONTAINS_ANY`, and one `GEO_RADIUS`. `LIKE` and `BETWEEN` throw `OperatorNotValid`; write `BETWEEN` as two range filters. Firestore's own limits and index requirements apply.
5. **`GEO_RADIUS` reads every candidate document.** It queries geohash ranges, filters by distance, then sorts, offsets, and limits in memory. Keep the radius proportionate to the data density.
6. **Pass only this package's units of work to a `FirestoreDAO`.** `FirestoreTransactionUnitOfWork` (from `FirestoreUnitOfWorkRunner.run`) or `FirestoreBatchUnitOfWork`, never a kernel `InMemoryUnitOfWork`.
7. **In a transaction, do every read before any write, and expect the callback to run more than once.** Firestore retries on contention. There is no outbox: return events from `run` and publish them after it resolves.
8. **A batch only writes.** Reads skip it, writes apply on `commit()`, and one commit must stay under Firestore's 10 MiB request limit. `create` fails the commit if the document exists.
9. **Soft delete stores `is_deleted` and `deleted_at`.** Reads match `is_deleted == false`, so run `DataMigrator` on existing documents before switching a collection to `"SOFT"`. Every query then also filters on `is_deleted`, which affects composite indexes.
10. **Debug logs carry document data.** Pass any kernel `Logger`; at `debug` level the DAO logs collection and document paths, IDs, result sizes, criteria, and the data it writes. Keep `debug` off in production if documents hold personal data.

## Rules by area

| Area | Rule file |
| --- | --- |
| Entities, models, and how they map to documents | [rules/mapping.md](rules/mapping.md) |
| Criteria, indexes, geo queries, counting | [rules/querying.md](rules/querying.md) |
| Transactions and batches | [rules/units-of-work.md](rules/units-of-work.md) |
| Soft delete and restore | [rules/soft-delete.md](rules/soft-delete.md) |
| Testing code that uses Firestore DAOs | [rules/testing.md](rules/testing.md) |

## Skills

| Task | Skill |
| --- | --- |
| Store an entity in a Firestore collection | [skills/create-firestore-dao](skills/create-firestore-dao/SKILL.md) |
| Find documents within a distance of a point | [skills/add-geo-search](skills/add-geo-search/SKILL.md) |
| Write several documents atomically, in a transaction or a batch | [skills/use-firestore-transactions](skills/use-firestore-transactions/SKILL.md) |
| Switch a collection to soft delete | [skills/enable-soft-delete](skills/enable-soft-delete/SKILL.md) |
| Test a Firestore DAO and the code that uses it | [skills/test-firestore-daos](skills/test-firestore-daos/SKILL.md) |
| Upgrade from 5.x to 6.x | [skills/migrate-to-v6](skills/migrate-to-v6/SKILL.md) |
