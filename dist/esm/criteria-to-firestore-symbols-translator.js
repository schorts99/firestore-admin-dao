"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CriteriaToFirestoreSymbolsTranslator = void 0;
const firestore_1 = require("firebase-admin/firestore");
const exceptions_1 = require("./exceptions");
class CriteriaToFirestoreSymbolsTranslator {
    static translateOperator(operator) {
        switch (operator) {
            case "EQUAL":
                return "==";
            case "NOT_EQUAL":
                return "!=";
            case "GREATER_THAN":
                return ">";
            case "GREATER_THAN_OR_EQUAL":
                return ">=";
            case "LESS_THAN":
                return "<";
            case "LESS_THAN_OR_EQUAL":
                return "<=";
            case "IN":
                return "in";
            case "NOT_IN":
                return "not-in";
            default:
                throw new exceptions_1.OperatorNotValid(`operator: ${operator}`);
        }
    }
    static translateOrderDirection(order) {
        switch (order) {
            case "ASC":
                return "asc";
            case "DESC":
                return "desc";
            case "NONE":
                return undefined;
            default:
                throw new exceptions_1.OrderNotValid(`order: ${order}`);
        }
    }
    static translateField(field) {
        switch (field) {
            case "id":
                return firestore_1.FieldPath.documentId();
            default:
                return field;
        }
    }
    static translateValue(value) {
        if (value instanceof Date) {
            return firestore_1.Timestamp.fromDate(value);
        }
        return value;
    }
}
exports.CriteriaToFirestoreSymbolsTranslator = CriteriaToFirestoreSymbolsTranslator;
//# sourceMappingURL=criteria-to-firestore-symbols-translator.js.map