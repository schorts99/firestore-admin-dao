"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreEntityFactory = void 0;
const shared_kernel_1 = require("@schorts/shared-kernel");
const firestore_types_to_primitives_formatter_1 = require("./firestore-types-to-primitives-formatter");
class FirestoreEntityFactory {
    collectionName;
    logger;
    constructor(collectionName, logger) {
        this.collectionName = collectionName;
        this.logger = logger;
    }
    fromSnapshot(docSnap) {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreEntityFactory",
            method: "fromSnapshot",
        }, { docSnap });
        if (!docSnap.exists) {
            return null;
        }
        const data = firestore_types_to_primitives_formatter_1.FirestoreTypesToPrimitivesFormatter.format(docSnap.data());
        this.logger?.debug({
            status: "IN_PROGRESS",
            class: "FirestoreEntityFactory",
            method: "fromSnapshot",
        }, { data });
        const entity = shared_kernel_1.EntityRegistry.create(this.collectionName, { id: docSnap.id, ...data });
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreEntityFactory",
            method: "fromSnapshot",
        }, { entity });
        return entity;
    }
    fromSnapshots(docs) {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreEntityFactory",
            method: "fromSnapshots",
        }, { docs });
        const entities = docs
            .filter((doc) => doc.exists)
            .map((doc) => this.fromSnapshot(doc))
            .filter(Boolean);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreEntityFactory",
            method: "fromSnapshots",
        }, { entities });
        return entities;
    }
}
exports.FirestoreEntityFactory = FirestoreEntityFactory;
//# sourceMappingURL=firestore-entity-factory.js.map