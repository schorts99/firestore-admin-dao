"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUnitOfWorkRunner = void 0;
const firestore_transaction_unit_of_work_1 = require("./firestore-transaction-unit-of-work");
class FirestoreUnitOfWorkRunner {
    firestore;
    constructor(firestore) {
        this.firestore = firestore;
    }
    async run(operation) {
        return this.firestore.runTransaction(async (tx) => {
            const uow = new firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork(tx);
            return await operation(uow);
        });
    }
}
exports.FirestoreUnitOfWorkRunner = FirestoreUnitOfWorkRunner;
//# sourceMappingURL=firestore-unit-of-work-runner.js.map