"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUnitOfWork = void 0;
const exceptions_1 = require("./exceptions");
class FirestoreUnitOfWork {
    firestore;
    batch;
    active = false;
    constructor(firestore) {
        this.firestore = firestore;
        this.batch = firestore.batch();
    }
    async begin() {
        this.active = true;
    }
    async commit() {
        if (!this.active) {
            throw new exceptions_1.TransactionNotActive();
        }
        await this.batch.commit();
        this.active = false;
    }
    async rollback() {
        this.batch = this.firestore.batch();
        this.active = false;
    }
    set(docRef, data) {
        this.batch.set(docRef, data);
    }
    update(docRef, data) {
        this.batch.update(docRef, data);
    }
    delete(docRef) {
        this.batch.delete(docRef);
    }
}
exports.FirestoreUnitOfWork = FirestoreUnitOfWork;
//# sourceMappingURL=firestore-unit-of-work.js.map