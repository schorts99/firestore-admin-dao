import {
  CollectionReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { Criteria, Logger, Order, readGeoRadius } from "@schorts/shared-kernel";

import { CriteriaToFirestoreSymbolsTranslator } from "./criteria-to-firestore-symbols-translator.js";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work.js";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work.js";
import { OperatorNotValid } from "./exceptions/index.js";
import { unitOfWorkKind } from "./log-context.js";

export class FirestoreCriteriaQueryExecutor {
  static async execute(
    collection: CollectionReference,
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    logger?: Logger,
  ): Promise<QuerySnapshot> {
    const geoFilter = criteria.filters.find(f => f.operator === "GEO_RADIUS");

    logger?.debug(
      '[FirestoreCriteriaQueryExecutor execute] started',
      { geoFilter, uow: unitOfWorkKind(uow), criteria, collectionName: collection.path },
    );

    if (geoFilter) {
      const geoField = geoFilter.field;
      const geoRadius = readGeoRadius(geoFilter.value);

      if (!geoRadius) {
        throw new OperatorNotValid(`GEO_RADIUS on "${geoField}" needs a center and a radius`);
      }

      const center: [number, number] = [geoRadius.lat, geoRadius.lng];
      const { radiusInM } = geoRadius;
      const bounds = geohashQueryBounds(center, radiusInM);
      const promises: Promise<QuerySnapshot>[] = [];

      logger?.debug(
        "[FirestoreCriteriaQueryExecutor execute] executing geospatial query with bounds",
        { bounds, center, radiusInM, geoField },
      );

      // Each bound is ordered by geohash, so orders, offset and limit can only be applied
      // once the bounds are merged and filtered by distance.
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

        logger?.debug(
          "[FirestoreCriteriaQueryExecutor execute] constructed query for geospatial bound",
        );

        if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
          promises.push(uow.getQuery(queryRef));
        } else {
          promises.push(queryRef.get());
        }
      }

      const snapshots = await Promise.all(promises);
      const allDocs = snapshots.flatMap((snap) => snap.docs);
      const uniqueDocsMap = new Map<string, DocumentSnapshot>();

      logger?.debug(
        "[FirestoreCriteriaQueryExecutor execute] retrieved all snapshots",
        { sizes: snapshots.map((snap) => snap.size) }
      );

      allDocs.forEach((doc) => uniqueDocsMap.set(doc.id, doc));

      const filteredDocs = Array.from(uniqueDocsMap.values()).filter((doc) => {
        const data = doc.data();
        const coords = data?.[geoField] as { latitude: number; longitude: number };

        if (!coords) return false;

        const distanceInM = distanceBetween(center, [coords.latitude, coords.longitude]) * 1000;

        return distanceInM <= radiusInM;
      });

      const offset = criteria.offset ?? 0;
      const pagedDocs = filteredDocs
        .sort((a, b) => compareDocs(a, b, criteria.orders))
        .slice(offset, criteria.limit ? offset + criteria.limit : undefined);

      logger?.debug(
        "[FirestoreCriteriaQueryExecutor execute] completed",
        { size: pagedDocs.length });

      return {
        docs: pagedDocs,
        empty: pagedDocs.length === 0,
        size: pagedDocs.length,
        forEach: (callback: (doc: DocumentSnapshot) => void) => pagedDocs.forEach(callback),
      } as QuerySnapshot;
    } else {
      logger?.debug(
        "[FirestoreCriteriaQueryExecutor execute] executing query with no geospatial filters",
      );

      const queryRef = this.buildQuery(collection, criteria);

      if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
        logger?.debug(
          "[FirestoreCriteriaQueryExecutor execute] completed",
        );

        return uow.getQuery(queryRef);
      }

      logger?.debug(
        "[FirestoreCriteriaQueryExecutor execute] completed",
      );

      return queryRef.get();
    }
  }

  static async count(
    collection: CollectionReference,
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    logger?: Logger,
  ): Promise<number> {
    logger?.debug(
      "[FirestoreCriteriaQueryExecutor count] started",
      { uow: unitOfWorkKind(uow), criteria, collectionName: collection.path },
    );

    // Distance can only be checked on the documents themselves.
    if (criteria.filters.some(f => f.operator === "GEO_RADIUS")) {
      const snapshot = await this.execute(collection, criteria, uow, logger);

      return snapshot.size;
    }

    const queryRef = this.buildQuery(collection, criteria);
    let count: number;

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      count = await uow.count(queryRef);
    } else {
      const snapshot = await queryRef.count().get();
      count = snapshot.data().count;
    }

    logger?.debug(
      "[FirestoreCriteriaQueryExecutor count] completed",
      { count },
    );

    return count;
  }

  private static buildQuery(collection: CollectionReference, criteria: Criteria): Query {
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
      queryRef = queryRef.offset(criteria.offset);
    }

    return queryRef;
  }
}

function compareDocs(a: DocumentSnapshot, b: DocumentSnapshot, orders: Order[]): number {
  for (const order of orders) {
    const left = sortableValue(a, order.field);
    const right = sortableValue(b, order.field);

    if (left === right) continue;

    // Missing values sort last in either direction.
    if (left === null) return 1;
    if (right === null) return -1;

    const comparison = left < right ? -1 : 1;

    return order.direction === "DESC" ? -comparison : comparison;
  }

  return 0;
}

function sortableValue(doc: DocumentSnapshot, field: string): string | number | boolean | null {
  const value: unknown = field === "id" ? doc.id : doc.get(field);

  if (value === undefined || value === null) return null;
  if (value instanceof Timestamp) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;

  return String(value);
}
