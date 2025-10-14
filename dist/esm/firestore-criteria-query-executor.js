"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCriteriaQueryExecutor = void 0;
const geofire_common_1 = require("geofire-common");
const criteria_to_firestore_symbols_translator_1 = require("./criteria-to-firestore-symbols-translator");
class FirestoreCriteriaQueryExecutor {
    static async execute(collection, criteria) {
        const geoFilterEntry = Object.entries(criteria.filters).find(([_, filter]) => filter.operator === "GEO_RADIUS");
        if (geoFilterEntry) {
            const [geoField, geoFilter] = geoFilterEntry;
            const { center, radiusInM } = geoFilter.value;
            const bounds = (0, geofire_common_1.geohashQueryBounds)(center, radiusInM);
            const promises = [];
            for (const b of bounds) {
                let queryRef = collection;
                for (const [field, filter] of Object.entries(criteria.filters)) {
                    if (field === geoField)
                        continue;
                    const firestoreField = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateField(field);
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
                promises.push(queryRef.get());
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
            for (const field in criteria.filters) {
                const filter = criteria.filters[field];
                const firestoreField = criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator.translateField(field);
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
            return queryRef.get();
        }
    }
}
exports.FirestoreCriteriaQueryExecutor = FirestoreCriteriaQueryExecutor;
//# sourceMappingURL=firestore-criteria-query-executor.js.map