"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreTransactionUnitOfWork = void 0;
class FirestoreTransactionUnitOfWork {
    transaction;
    constructor(transaction) {
        this.transaction = transaction;
    }
    async begin() { }
    async commit() { }
    async rollback() {
        throw new Error('Manual rollback not supported in Firestore transactions');
    }
    get(ref) {
        return this.transaction.get(ref);
    }
    getQuery(query) {
        return this.transaction.get(query);
    }
    create(docRef, data) {
        this.transaction.create(docRef, data);
    }
    update(docRef, data) {
        this.transaction.update(docRef, data);
    }
    delete(docRef) {
        this.transaction.delete(docRef);
    }
}
exports.FirestoreTransactionUnitOfWork = FirestoreTransactionUnitOfWork;
//# sourceMappingURL=firestore-transaction-unit-of-work.js.map