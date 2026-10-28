---
name: enable-soft-delete
description: Switch a Firestore collection from hard to soft delete with @schorts/firestore-admin-dao — backfill is_deleted and deleted_at with DataMigrator, change the DAO's delete mode, update composite indexes, read deleted documents with includeDeleted, and restore them. Use when deleted Firestore records must be kept, listed, or recoverable.
---

# Enable soft delete

In `"SOFT"` mode, `delete` flags a document (`is_deleted: true`, `deleted_at`) instead of removing it, reads hide flagged documents, and `restore` brings them back. Read [rules/soft-delete.md](../../rules/soft-delete.md) first.

The order matters: reads in `"SOFT"` mode only match documents that have `is_deleted: false`, so every existing document must get the field **before** the DAO switches modes.

## 1. Backfill the collection

`DataMigrator` pages through the collection by document ID and adds `is_deleted: false` and `deleted_at: null` where they are missing. It is idempotent.

```ts
// file: scripts/backfill-soft-delete.ts
import { DataMigrator, getApps, getFirestore, initializeApp } from "@schorts/firestore-admin-dao";
import { ConsoleLogger } from "@schorts/shared-kernel/logger";

export async function backfillSoftDelete(collectionPath: string): Promise<void> {
  const firestore = getFirestore(getApps()[0] ?? initializeApp());
  const migrator = new DataMigrator(firestore.collection(collectionPath), new ConsoleLogger("info"));

  await migrator.migrateFromHardToSoftDelete();
}
```

Run it against each environment before deploying step 2. Pass a third argument to change the page size (default 500).

## 2. Switch the DAO

```ts
// file: notes/note-dao.ts
import { FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { Criteria } from "@schorts/shared-kernel/criteria";
import { Entity } from "@schorts/shared-kernel/entities";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class NoteId extends UUIDValue {
  readonly attributeName = "noteId";
}

export type NoteModel = { id: string; owner_id: string; text: string; deleted_at: string | null };

export class Note extends Entity<NoteId, NoteModel> {
  constructor(id: NoteId, public ownerId = "", public text = "", public deletedAt: string | null = null) {
    super(id);
  }

  toPrimitives(): NoteModel {
    return { id: this.id.value, owner_id: this.ownerId, text: this.text, deleted_at: this.deletedAt };
  }

  protected override createId(rawId: unknown): NoteId {
    return new NoteId(String(rawId));
  }

  protected override restoreFromPrimitives(data: NoteModel): void {
    this.ownerId = data.owner_id;
    this.text = data.text;
    this.deletedAt = data.deleted_at;
  }
}

export const NOTES = "notes";

export class NoteDAO extends FirestoreDAO<NoteModel, Note> {
  constructor(collection: CollectionReference) {
    super(collection, "SOFT");
  }

  findByOwner(ownerId: string): Promise<Note[]> {
    return this.search(Criteria.none().where("owner_id", "EQUAL", ownerId));
  }

  findTrashByOwner(ownerId: string): Promise<Note[]> {
    return this.search(
      Criteria.none().where("owner_id", "EQUAL", ownerId).where("is_deleted", "EQUAL", true),
      undefined,
      true,
    );
  }
}
```

- `deleted_at` comes back as an ISO string after a soft delete, so the model types it as `string | null`.
- Read methods take `includeDeleted` as their third argument; `findTrashByOwner` passes `true` and filters on `is_deleted` itself.

## 3. Update the indexes

Every criteria query now also filters `is_deleted == false`. Queries that order or range-filter on another field need `is_deleted` in their composite index, for example `(is_deleted, owner_id, updated_at)`. Deploy the indexes with the DAO change.

## 4. Delete and restore

```ts
// file: notes/trash.ts
import type { NoteDAO } from "./note-dao.js";

export class NoteNotFound extends Error {
  override name = "NoteNotFound";
}

export async function trashNote(notes: NoteDAO, id: string): Promise<void> {
  await notes.deleteByID(id);
}

export async function restoreNote(notes: NoteDAO, id: string): Promise<void> {
  const note = await notes.findByID(id, undefined, true);
  if (!note) throw new NoteNotFound(`Note ${id} does not exist`);

  // Clears is_deleted/deleted_at on the document and deletedAt on the entity.
  await notes.restore(note);
}
```

- `update`/`save` also write `is_deleted: false`, so saving a trashed note restores it. Guard edits to trashed notes in the domain if that matters.
- `create` with the ID of a soft-deleted document fails, because the document still exists.

## 5. Run the migrator once more

After the deploy, run step 1 again to catch documents written by old instances between the backfill and the switch.

## Checklist

- [ ] `DataMigrator` run on every environment before the switch, and once after.
- [ ] DAO constructed with `"SOFT"`.
- [ ] Composite indexes include `is_deleted`.
- [ ] Trash views pass `includeDeleted = true`; restore uses `restore`.
- [ ] Emulator test: delete hides, `includeDeleted` shows, `restore` brings back.
