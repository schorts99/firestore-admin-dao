# Soft delete rules

Applies to DAOs constructed with `"SOFT"` and to `DataMigrator`.

## How it is stored

| Operation | Document fields |
| --- | --- |
| `create`, `update`, `save`, `restore` | `is_deleted: false`, `deleted_at: null` |
| `delete`, `deleteByID` | `is_deleted: true`, `deleted_at: Timestamp.now()` from the server running the code (the document stays) |

- Reads (`findByID`, `findOneBy`, `search`, `getAll`, `count`, `countBy`, `exists`) skip documents where `is_deleted` is not `false`, unless you pass `includeDeleted = true`.
- **Documents without `is_deleted` are invisible.** Firestore cannot match a missing field, so documents written in `"HARD"` mode disappear after switching to `"SOFT"`. Run `DataMigrator.migrateFromHardToSoftDelete()` on the collection first.
- `update` and `save` write `is_deleted: false`. Saving a soft-deleted entity therefore restores it. Check `findByID(id, uow, true)` first if that is not what you want.
- `restore(entity)` clears the fields on the document and sets `isDeleted`/`is_deleted` to `false` and `deletedAt`/`deleted_at` to `null` on the entity, if it has those properties. `delete` does not change the entity.
- `restore` in `"HARD"` mode throws `EntityNotRecoverable`.
- Soft-deleted documents still exist: they count toward storage, and a `create` with the same ID fails. Use `restore` or `save` to bring one back.

## Indexes

Every criteria query in `"SOFT"` mode gets `is_deleted == false` added. A query that orders or range-filters on another field then needs a composite index starting with `is_deleted`. Geo queries need `(is_deleted, <field>_geohash)`.

## Migrating a collection

- `new DataMigrator(collection, logger?, pageSize = 500).migrateFromHardToSoftDelete()` pages through the collection by document ID and commits one batch per page that needs changes, adding only the missing fields.
- It is safe to run again; documents that already have both fields are skipped.
- It is not one atomic change. Run it before deploying the code that switches the DAO to `"SOFT"`, then once more after the deploy to catch documents written in between.

See [skills/enable-soft-delete](../skills/enable-soft-delete/SKILL.md).
