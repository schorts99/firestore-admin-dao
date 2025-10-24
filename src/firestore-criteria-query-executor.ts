import {
  CollectionReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { Criteria } from "@schorts/shared-kernel";

import { CriteriaToFirestoreSymbolsTranslator } from "./criteria-to-firestore-symbols-translator";

export class FirestoreCriteriaQueryExecutor {
  static async execute(collection: CollectionReference, criteria: Criteria): Promise<QuerySnapshot> {
    const geoFilter = criteria.filters.find(f => f.operator === "GEO_RADIUS");

    if (geoFilter) {
      const geoField = geoFilter.field;
      const { center, radiusInM } = geoFilter.value;
      const bounds = geohashQueryBounds(center, radiusInM);
      const promises: Promise<QuerySnapshot>[] = [];

      for (const b of bounds) {
        let queryRef: Query = collection;

        for (const filter of criteria.filters) {
          if (filter.field === geoField) continue;

          const firestoreField = CriteriaToFirestoreSymbolsTranslator.translateField(filter.field);
          const firestoreOperator = CriteriaToFirestoreSymbolsTranslator.translateOperator(filter.operator);
          const firestoreValue = CriteriaToFirestoreSymbolsTranslator.translateValue(filter.value);

          queryRef = queryRef.where(firestoreField, firestoreOperator, firestoreValue);
        }

        queryRef = queryRef
          .orderBy(`${geoField}_geohash`)
          .startAt(b[0])
          .endAt(b[1]);

        for (const order of criteria.orders) {
          const firestoreDirection = CriteriaToFirestoreSymbolsTranslator.translateOrderDirection(order.direction);
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
      const uniqueDocsMap = new Map<string, DocumentSnapshot>();

      allDocs.forEach(doc => uniqueDocsMap.set(doc.id, doc));

      const filteredDocs = Array.from(uniqueDocsMap.values()).filter((doc) => {
        const data = doc.data();
        const coords = data?.[geoField] as { latitude: number; longitude: number };

        if (!coords) return false;

        const distanceInM = distanceBetween(center, [coords.latitude, coords.longitude]) * 1000;
        return distanceInM <= radiusInM;
      });

      return {
        docs: filteredDocs,
        empty: filteredDocs.length === 0,
        size: filteredDocs.length,
        forEach: (callback: (doc: DocumentSnapshot) => void) => filteredDocs.forEach(callback),
      } as QuerySnapshot;
    } else {
      let queryRef: Query = collection;

      for (const filter of criteria.filters) {
        const firestoreField = CriteriaToFirestoreSymbolsTranslator.translateField(filter.field);
        const firestoreOperator = CriteriaToFirestoreSymbolsTranslator.translateOperator(filter.operator);
        const firestoreValue = CriteriaToFirestoreSymbolsTranslator.translateValue(filter.value);

        queryRef = queryRef.where(firestoreField, firestoreOperator, firestoreValue);
      }

      for (const order of criteria.orders) {
        const firestoreDirection = CriteriaToFirestoreSymbolsTranslator.translateOrderDirection(order.direction);
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
