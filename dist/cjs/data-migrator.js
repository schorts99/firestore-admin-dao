"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataMigrator = void 0;
const firestore_batch_unit_of_work_1 = require("./firestore-batch-unit-of-work");
class DataMigrator {
    collection;
    logger;
    constructor(collection, logger) {
        this.collection = collection;
        this.logger = logger;
    }
    async migrateFromHardToSoftDelete() {
        this.logger?.debug({
            status: "STARTED",
            class: "DataMigrator",
            method: "migrateFromHardToSoftDelete",
            collectionName: this.collection.path,
        });
        const uow = new firestore_batch_unit_of_work_1.FirestoreBatchUnitOfWork(this.collection.firestore);
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
exports.DataMigrator = DataMigrator;
//# sourceMappingURL=data-migrator.js.map