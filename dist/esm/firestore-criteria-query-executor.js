"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCriteriaQueryExecutor = void 0;
const geofire_common_1 = require("geofire-common");
const criteria_to_firestore_symbols_translator_1 = require("./criteria-to-firestore-symbols-translator");
const firestore_transaction_unit_of_work_1 = require("./firestore-transaction-unit-of-work");
class FirestoreCriteriaQueryExecutor {
    static async execute(collection, criteria, uow) {
        const geoFilter = criteria.filters.find(f => f.operator === "GEO_RADIUS");
        if (geoFilter) {
            const geoField = geoFilter.field;
            const { center, radiusInM } = geoFilter.value;
            const bounds = (0, geofire_common_1.geohashQueryBounds)(center, radiusInM);
            const promises = [];
            for (const b of bounds) {
                let queryRef = collection;
                for (const filter of criteria.filters) {
                    if (filter.field === geoField)
                        continue;
                    const firestoreField = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateField(filter.field);
                    const firestoreOperator = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateOperator(filter.operator);
                    const firestoreValue = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateValue(filter.value);
                    queryRef = queryRef.where(firestoreField, firestoreOperator, firestoreValue);
                }
                queryRef = queryRef
                    .orderBy(`${geoField}_geohash`)
                    .startAt(b[0])
                    .endAt(b[1]);
                for (const order of criteria.orders) {
                    const firestoreDirection = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateOrderDirection(order.direction);
                    queryRef = firestoreDirection
                        ? queryRef.orderBy(order.field, firestoreDirection)
                        : queryRef.orderBy(order.field);
                }
                if (criteria.limit) {
                    queryRef = queryRef.limit(criteria.limit);
                }
                if (uow && uow instanceof firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork) {
                    promises.push(uow.getQuery(queryRef));
                }
                else {
                    promises.push(queryRef.get());
                }
            }
            const snapshots = await Promise.all(promises);
            const allDocs = snapshots.flatMap((snap) => snap.docs);
            const uniqueDocsMap = new Map();
            allDocs.forEach(doc => uniqueDocsMap.set(doc.id, doc));
            const filteredDocs = Array.from(uniqueDocsMap.values()).filter((doc) => {
                const data = doc.data();
                const coords = data?.[geoField];
                if (!coords)
                    return false;
                const distanceInM = (0, geofire_common_1.distanceBetween)(center, [coords.latitude, coords.longitude]) * 1000;
                return distanceInM <= radiusInM;
            });
            return {
                docs: filteredDocs,
                empty: filteredDocs.length === 0,
                size: filteredDocs.length,
                forEach: (callback) => filteredDocs.forEach(callback),
            };
        }
        else {
            let queryRef = collection;
            for (const filter of criteria.filters) {
                const firestoreField = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateField(filter.field);
                const firestoreOperator = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateOperator(filter.operator);
                const firestoreValue = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateValue(filter.value);
                queryRef = queryRef.where(firestoreField, firestoreOperator, firestoreValue);
            }
            for (const order of criteria.orders) {
                const firestoreDirection = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateOrderDirection(order.direction);
                queryRef = firestoreDirection
                    ? queryRef.orderBy(order.field, firestoreDirection)
                    : queryRef.orderBy(order.field);
            }
            if (criteria.limit) {
                queryRef = queryRef.limit(criteria.limit);
            }
            if (criteria.offset) {
                queryRef = queryRef.startAfter(criteria.offset);
            }
            if (uow && uow instanceof firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork) {
                return uow.getQuery(queryRef);
            }
            return queryRef.get();
        }
    }
}
exports.FirestoreCriteriaQueryExecutor = FirestoreCriteriaQueryExecutor;
//# sourceMappingURL=firestore-criteria-query-executor.js.map