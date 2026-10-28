import { CollectionReference, DocumentSnapshot, FieldPath, Query } from "firebase-admin/firestore";
import { Logger } from "@schorts/shared-kernel";

import { FirestoreBatchUnitOfWork } from './firestore-batch-unit-of-work';

/**
 * Documents read, and updates committed, per page. Paging keeps memory flat on large
 * collections and keeps each commit far below Firestore's 10 MiB request size limit.
 */
const DEFAULT_PAGE_SIZE = 500;

export class DataMigrator {
  constructor(
    private readonly collection: CollectionReference,
    private readonly logger?: Logger,
    private readonly pageSize = DEFAULT_PAGE_SIZE,
  ) {}

  async migrateFromHardToSoftDelete() {
    this.logger?.debug("[DataMigrator migrateFromHardToSoftDelete] started", {
      collectionName: this.collection.path,
    });

    const pageSize = Math.max(1, Math.floor(this.pageSize));
    let lastDoc: DocumentSnapshot | undefined;
    let migrated = 0;

    while (true) {
      let query: Query = this.collection.orderBy(FieldPath.documentId()).limit(pageSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        break;
      }

      const updates: Array<[DocumentSnapshot, Record<string, any>]> = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const newData: Record<string, any> = {};

        if (data["is_deleted"] === undefined) {
          newData["is_deleted"] = false;
        }

        if (data["deleted_at"] === undefined) {
          newData["deleted_at"] = null;
        }

        if (Object.keys(newData).length > 0) {
          updates.push([doc, newData]);
        }
      }

      if (updates.length > 0) {
        const uow = new FirestoreBatchUnitOfWork(
          this.collection.firestore,
        );

        await uow.begin();

        for (const [doc, newData] of updates) {
          uow.update(doc.ref, newData);
        }

        await uow.commit();
      }

      migrated += updates.length;

      this.logger?.debug("[DataMigrator migrateFromHardToSoftDelete] migration in progress", {
        pageSize: snapshot.size,
        updates: updates.length,
        migrated,
      });

      if (snapshot.size < pageSize) {
        break;
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    this.logger?.debug("[DataMigrator migrateFromHardToSoftDelete] completed", {
      migrated,
    });
  }
}
