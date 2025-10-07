"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreEntityFactory = void 0;
const shared_kernel_1 = require("@schorts/shared-kernel");
const firestore_types_to_primitives_formatter_1 = require("./firestore-types-to-primitives-formatter");
class FirestoreEntityFactory {
    collectionName;
    constructor(collectionName) {
        this.collectionName = collectionName;
    }
    fromSnapshot(docSnap) {
        if (!docSnap.exists) {
            return null;
        }
        const data = firestore_types_to_primitives_formatter_1.FirestoreTypesToPrimitivesFormatter.format(docSnap.data());
        return shared_kernel_1.EntityRegistry.create(this.collectionName, { id: docSnap.id, ...data });
    }
    fromSnapshots(docs) {
        return docs
            .filter((doc) => doc.exists)
            .map((doc) => this.fromSnapshot(doc))
            .filter(Boolean);
    }
}
exports.FirestoreEntityFactory = FirestoreEntityFactory;
//# sourceMappingURL=firestore-entity-factory.js.map