"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreBatchUnitOfWork = void 0;
const exceptions_1 = require("./exceptions");
class FirestoreBatchUnitOfWork {
    firestore;
    batch;
    active = false;
    logger;
    constructor(firestore, logger) {
        this.firestore = firestore;
        this.batch = firestore.batch();
        this.logger = logger;
    }
    async begin() {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreBatchUnitOfWork",
            method: "begin",
        }, { active: this.active });
        this.active = true;
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreBatchUnitOfWork",
            method: "begin",
        }, { active: this.active });
    }
    async commit() {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreBatchUnitOfWork",
            method: "commit",
        }, { active: this.active });
        if (!this.active) {
            throw new exceptions_1.TransactionNotActive();
        }
        this.logger?.debug({
            status: "IN_PROGRESS",
            class: "FirestoreBatchUnitOfWork",
            method: "commit",
        }, { batch: this.batch });
        await this.batch.commit();
        this.active = false;
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreBatchUnitOfWork",
            method: "commit",
        }, { active: this.active });
    }
    async rollback() {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreBatchUnitOfWork",
            method: "rollback",
        }, { active: this.active, batch: this.batch });
        this.batch = this.firestore.batch();
        this.active = false;
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreBatchUnitOfWork",
            method: "rollback",
        }, { active: this.active, batch: this.batch });
    }
    create(docRef, data) {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreBatchUnitOfWork",
            method: "create",
        }, { batch: this.batch });
        this.batch.set(docRef, data);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreBatchUnitOfWork",
            method: "create",
        }, { batch: this.batch });
    }
    update(docRef, data) {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreBatchUnitOfWork",
            method: "update",
        }, { batch: this.batch });
        this.batch.update(docRef, data);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreBatchUnitOfWork",
            method: "update",
        }, { batch: this.batch });
    }
    delete(docRef) {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreBatchUnitOfWork",
            method: "delete",
        }, { batch: this.batch });
        this.batch.delete(docRef);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreBatchUnitOfWork",
            method: "delete",
        }, { batch: this.batch });
    }
}
exports.FirestoreBatchUnitOfWork = FirestoreBatchUnitOfWork;
//# sourceMappingURL=firestore-batch-unit-of-work.js.map