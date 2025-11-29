import { CollectionReference } from "firebase-admin/firestore";
import { Logger } from "@schorts/shared-kernel";

import { FirestoreBatchUnitOfWork } from './firestore-batch-unit-of-work';

export class DataMigrator {
  constructor(
    private readonly collection: CollectionReference,
    private readonly logger?: Logger,
  ) {}

  async migrateFromHardToSoftDelete() {
    this.logger?.debug({
      status: "STARTED",
      class: "DataMigrator",
      method: "migrateFromHardToSoftDelete",
      collectionName: this.collection.path,
    });

    const uow = new FirestoreBatchUnitOfWork(
      this.collection.firestore,
    );

    await uow.begin();

    const snapshot = await this.collection.get();

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "DataMigrator",
      method: "migrateFromHardToSoftDelete",
      collectionName: this.collection.path,
    }, { snapshot });

    if (snapshot.empty) {
      return;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (data["is_deleted"] === undefined) {
        uow.update(doc.ref, { is_deleted: false });
      }
    }

    await uow.commit();

    this.logger?.debug({
      status: "COMPLETED",
      class: "DataMigrator",
      method: "migrateFromHardToSoftDelete",
      collectionName: this.collection.path,
    });
  }
}
