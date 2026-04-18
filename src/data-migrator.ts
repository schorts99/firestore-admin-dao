import { CollectionReference } from "firebase-admin/firestore";
import { Logger } from "@schorts/shared-kernel";

import { FirestoreBatchUnitOfWork } from './firestore-batch-unit-of-work';

export class DataMigrator {
  constructor(
    private readonly collection: CollectionReference,
    private readonly logger?: Logger,
  ) {}

  async migrateFromHardToSoftDelete() {
    this.logger?.debug("[DataMigrator migrateFromHardToSoftDelete] started", {
      collectionName: this.collection.path,
    });

    const uow = new FirestoreBatchUnitOfWork(
      this.collection.firestore,
    );

    await uow.begin();

    const snapshot = await this.collection.get();

    this.logger?.debug("[DataMigrator migrateFromHardToSoftDelete] migration in progress", {
      snapshot,
    });

    if (snapshot.empty) {
      return;
    }

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
        uow.update(doc.ref, newData);
      }
    }

    await uow.commit();

    this.logger?.debug("[DataMigrator migrateFromHardToSoftDelete] completed");
  }
}
