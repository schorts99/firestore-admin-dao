"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreTransactionUnitOfWork = void 0;
const exceptions_1 = require("./exceptions");
class FirestoreTransactionUnitOfWork {
    firestore;
    transaction = null;
    active = false;
    constructor(firestore) {
        this.firestore = firestore;
    }
    async begin() {
        if (this.active)
            return;
        await this.firestore.runTransaction(async (tx) => {
            this.transaction = tx;
            this.active = true;
            await new Promise((resolve, reject) => {
                this.resolveTransaction = resolve;
                this.rejectTransaction = reject;
            });
        });
        this.active = false;
        this.transaction = null;
    }
    resolveTransaction = null;
    rejectTransaction = null;
    async commit() {
        if (!this.active || !this.resolveTransaction) {
            throw new exceptions_1.TransactionNotActive();
        }
        this.resolveTransaction();
    }
    async rollback() {
        if (!this.active || !this.rejectTransaction) {
            throw new exceptions_1.TransactionNotActive();
        }
        this.rejectTransaction(new exceptions_1.TransactionRollback());
    }
    set(docRef, data) {
        if (!this.transaction)
            throw new exceptions_1.TransactionNotActive();
        this.transaction.set(docRef, data);
    }
    update(docRef, data) {
        if (!this.transaction)
            throw new exceptions_1.TransactionNotActive();
        this.transaction.update(docRef, data);
    }
    delete(docRef) {
        if (!this.transaction)
            throw new exceptions_1.TransactionNotActive();
        this.transaction.delete(docRef);
    }
    get(docRef) {
        if (!this.transaction)
            throw new exceptions_1.TransactionNotActive();
        return this.transaction.get(docRef);
    }
    getQuery(query) {
        if (!this.transaction)
            throw new exceptions_1.TransactionNotActive();
        return this.transaction.get(query);
    }
}
exports.FirestoreTransactionUnitOfWork = FirestoreTransactionUnitOfWork;
//# sourceMappingURL=firestore-transaction-unit-of-work.js.map