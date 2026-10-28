---
name: migrate-to-v6
description: Upgrade a project from @schorts/firestore-admin-dao 5.x to 6.x — move to @schorts/shared-kernel 11 and firebase-admin 14, then check the behavior changes in getAll, count, batch create, geo radius queries, exists, and DataMigrator. Use when bumping the package to 6 or when results change after the upgrade.
---

# Migrate from 5.x to 6.x

6.0 requires `@schorts/shared-kernel` 11 and moves to `firebase-admin` 14. The Firestore API of this package did not change shape; the changes are in behavior. Work through the steps in order.

## 1. Upgrade the packages

```bash
npm install @schorts/firestore-admin-dao@^6 @schorts/shared-kernel@^11
npx tsc --noEmit
```

Type errors come from the kernel upgrade. Follow `node_modules/@schorts/shared-kernel/ai/skills/migrate-to-v11/SKILL.md` to fix them; typed `Criteria` values are the most common.

`firebase-admin` 14 is now a dependency of this package. If your project also depends on `firebase-admin` directly, move it to 14 as well, so the app you initialize and the one this package uses are the same, and check its release notes for changes that affect your own code.

## 2. Check the behavior changes

| Change in 6.0 | What to check |
| --- | --- |
| `getAll()` returns every document. 5.x stopped at 1000. | Calls to `getAll()` on large collections: replace them with `search` and a filter or limit. |
| `count()` and `countBy()` use aggregate count queries. `count()` was capped at 1000; `countBy()` read every matching document. | Code that compensated for the cap. Counts may now be larger and reads cheaper. |
| `FirestoreBatchUnitOfWork.create` uses `batch.create`. 5.x overwrote existing documents. | Imports or seeders that `create` documents that may exist: the commit now fails. Use `save` or `update` for those. |
| `GEO_RADIUS` applies orders, offset, and limit after merging and distance-filtering. 5.x limited and ordered each geohash range separately and ignored offset. | Geo results are now correctly ordered and limited, and may differ from before. The range queries no longer order by your fields, so composite indexes that existed only for that can be removed. |
| `GEO_RADIUS` accepts every shape the kernel 11 defines; a value without a center or radius throws `OperatorNotValid`. | Values that 5.x read as `{ center, radiusInM }`. Those still work. |
| `exists(criteria, uow, includeDeleted)` honors `includeDeleted`. | Code that passed `true` and relied on deleted documents still being hidden. |
| Debug log contexts hold plain data (paths, IDs, sizes, `uow` as a class name) instead of Firestore references, snapshots, and units of work. Loggers that clone context, such as the kernel's `InMemoryLogger`, no longer throw `DataCloneError`. | Log processing that read fields of the old objects. |
| `DataMigrator` pages through the collection (500 documents per page by default, new optional third constructor argument) instead of one batch for everything. | Nothing, unless you relied on the migration being a single atomic batch. |

## 3. Tests

- Mocks of `firebase-admin/firestore` that implemented `WriteBatch.set` for `create` now need `WriteBatch.create`.
- Queries mocked for `count()` now need `count().get()` returning `{ data: () => ({ count }) }`.
- Prefer the emulator over mocks for DAO tests (see [test-firestore-daos](../test-firestore-daos/SKILL.md)).

## 4. Finish

```bash
npx tsc --noEmit
npm test
```

Search for `getAll(` on large collections and for batch `create` calls on documents that may exist.
