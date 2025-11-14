import { CollectionReference } from "firebase-admin/firestore";
import { Logger } from "@schorts/shared-kernel";

import { FirestoreBatchUnitOfWork } from './firestore-batch-unit-of-work';

export class DataMigrator {
  constructor(
    private readonly collection: CollectionReference,
    private readonly logger?: Logger,
  ) {}

  async migrateFromHardToSoftDelete() {
    const uow = new FirestoreBatchUnitOfWork(
      this.collection.firestore,
    );

    await uow.begin();

    const snapshot = await this.collection.get();

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
  }
}
