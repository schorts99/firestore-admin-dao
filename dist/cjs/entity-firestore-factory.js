"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityFirestoreFactory = void 0;
const primitive_types_to_firestore_formatter_1 = require("./primitive-types-to-firestore-formatter");
class EntityFirestoreFactory {
    static fromEntity(entity) {
        const raw = {
            ...entity.toPrimitives(),
            ...primitive_types_to_firestore_formatter_1.PrimitiveTypesToFirestoreFormatter.format(entity),
        };
        delete raw["id"];
        return raw;
    }
}
exports.EntityFirestoreFactory = EntityFirestoreFactory;
//# sourceMappingURL=entity-firestore-factory.js.map