import {
  CollectionReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { Criteria, Logger } from "@schorts/shared-kernel";

import { CriteriaToFirestoreSymbolsTranslator } from "./criteria-to-firestore-symbols-translator";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";

export class FirestoreCriteriaQueryExecutor {
  static async execute(
    collection: CollectionReference,
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    logger?: Logger,
  ): Promise<QuerySnapshot> {
    const geoFilter = criteria.filters.find(f => f.operator === "GEO_RADIUS");

    logger?.debug({
      status: "STARTED",
      class: "FirestoreCriteriaQueryExecutor",
      method: "execute",
    }, { geoFilter, uow });

    if (geoFilter) {
      const geoField = geoFilter.field;
      const { center, radiusInM } = geoFilter.value;
      const bounds = geohashQueryBounds(center, radiusInM);
      const promises: Promise<QuerySnapshot>[] = [];

      logger?.debug({
        status: "IN_PROGRESS",
        class: "FirestoreCriteriaQueryExecutor",
        method: "execute",
      }, { bounds, center, radiusInM, geoField });

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

        logger?.debug({
          status: "IN_PROGRESS",
          class: "FirestoreCriteriaQueryExecutor",
          method: "execute",
        }, { queryRef });

        if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
          promises.push(uow.getQuery(queryRef));
        } else {
          promises.push(queryRef.get());
        }
      }

      const snapshots = await Promise.all(promises);
      const allDocs = snapshots.flatMap((snap) => snap.docs);
      const uniqueDocsMap = new Map<string, DocumentSnapshot>();

      logger?.debug({
        status: "IN_PROGRESS",
        class: "FirestoreCriteriaQueryExecutor",
        method: "execute",
      }, { snapshots });

      allDocs.forEach(doc => uniqueDocsMap.set(doc.id, doc));

      const filteredDocs = Array.from(uniqueDocsMap.values()).filter((doc) => {
        const data = doc.data();
        const coords = data?.[geoField] as { latitude: number; longitude: number };

        if (!coords) return false;

        const distanceInM = distanceBetween(center, [coords.latitude, coords.longitude]) * 1000;
        return distanceInM <= radiusInM;
      });

      logger?.debug({
        status: "COMPLETED",
        class: "FirestoreCriteriaQueryExecutor",
        method: "execute",
      }, { filteredDocs });

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

      if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
        return uow.getQuery(queryRef);
      }

      logger?.debug({
        status: "COMPLETED",
        class: "FirestoreCriteriaQueryExecutor",
        method: "execute",
      }, { queryRef });

      return queryRef.get()
    }
  }
}
