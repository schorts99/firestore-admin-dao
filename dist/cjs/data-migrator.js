"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataMigrator = void 0;
const firestore_batch_unit_of_work_1 = require("./firestore-batch-unit-of-work");
class DataMigrator {
    collection;
    constructor(collection) {
        this.collection = collection;
    }
    async migrateFromHardToSoftDelete() {
        const uow = new firestore_batch_unit_of_work_1.FirestoreBatchUnitOfWork(this.collection.firestore);
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
exports.DataMigrator = DataMigrator;
//# sourceMappingURL=data-migrator.js.map