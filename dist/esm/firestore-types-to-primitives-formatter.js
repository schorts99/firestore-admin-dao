"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreTypesToPrimitivesFormatter = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestoreTypesToPrimitivesFormatter {
    static format(data) {
        return this.formatTimestamps(data);
    }
    static formatTimestamps(data) {
        const formattedDates = { ...data };
        Object.keys(formattedDates).forEach((key) => {
            if (formattedDates[key] instanceof firestore_1.Timestamp) {
                formattedDates[key] = formattedDates[key].toDate().toString();
            }
        });
        return formattedDates;
    }
}
exports.FirestoreTypesToPrimitivesFormatter = FirestoreTypesToPrimitivesFormatter;
//# sourceMappingURL=firestore-types-to-primitives-formatter.js.map