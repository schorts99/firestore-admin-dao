import type { CollectionReference, Transaction } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { geohashQueryBounds } from "geofire-common";
import { Criteria, type GeoRadiusFilterValue } from "@schorts/shared-kernel";

import { FirestoreCriteriaQueryExecutor } from "../src/firestore-criteria-query-executor";
import { FirestoreTransactionUnitOfWork } from "../src/firestore-transaction-unit-of-work";
import { OperatorNotValid } from "../src/exceptions";
import { asFirestore, FakeCollection, fakeTransaction, RecordingLogger } from "./helpers/fake-firestore";

function execute(
  collection: FakeCollection,
  criteria: Criteria,
  uow?: FirestoreTransactionUnitOfWork,
) {
  return FirestoreCriteriaQueryExecutor.execute(
    asFirestore<CollectionReference>(collection),
    criteria,
    uow,
    new RecordingLogger(),
  );
}

describe("FirestoreCriteriaQueryExecutor", () => {
  describe("without a geo filter", () => {
    it("translates filters, orders, limit and offset into one query", async () => {
      const collection = new FakeCollection("users", { a: { name: "Ada" } });
      const createdAfter = new Date("2026-01-01T00:00:00.000Z");
      const criteria = new Criteria()
        .where("id", "IN", ["a", "b"])
        .where("created_at", "GREATER_THAN", createdAfter)
        .orderBy("name", "DESC")
        .limitResults(10)
        .offsetResults(20);

      const snapshot = await execute(collection, criteria);

      expect(snapshot.size).toBe(1);
      expect(collection.issued).toHaveLength(1);
      expect(collection.issued[0]).toEqual([
        ["where", "__mocked_document_id__", "in", ["a", "b"]],
        ["where", "created_at", ">", Timestamp.fromDate(createdAfter)],
        ["orderBy", "name", "desc"],
        ["limit", 10],
        ["offset", 20],
      ]);
    });

    it("orders without a direction for NONE", async () => {
      const collection = new FakeCollection("users");

      await execute(collection, new Criteria([], [{ field: "age", direction: "NONE" }]));

      expect(collection.issued[0]).toEqual([["orderBy", "age"]]);
    });

    it("runs a bare query for empty criteria", async () => {
      const collection = new FakeCollection("users");

      const snapshot = await execute(collection, new Criteria());

      expect(snapshot.empty).toBe(true);
      expect(collection.issued).toEqual([[]]);
    });

    it("reads through the transaction when one is given", async () => {
      const collection = new FakeCollection("users");
      const transaction = fakeTransaction();
      const uow = new FirestoreTransactionUnitOfWork(asFirestore<Transaction>(transaction));

      await execute(collection, new Criteria().where("name", "EQUAL", "Ada"), uow);

      expect(transaction.get).toHaveBeenCalledTimes(1);
    });

    it("rejects operators Firestore cannot express", async () => {
      const collection = new FakeCollection("users");

      await expect(execute(collection, new Criteria().where("name", "LIKE", "Ad%"))).rejects.toBeInstanceOf(
        OperatorNotValid,
      );
    });
  });

  describe("with a GEO_RADIUS filter", () => {
    const center: [number, number] = [0, 0];
    const docs = {
      near: { location: { latitude: 0.001, longitude: 0 }, status: "active" },
      far: { location: { latitude: 1, longitude: 0 }, status: "active" },
      nowhere: { status: "active" },
    };

    it("queries every geohash bound and keeps only documents inside the radius", async () => {
      const collection = new FakeCollection("places", docs);
      const criteria = new Criteria()
        .where("location", "GEO_RADIUS", { center, radiusInM: 1000 })
        .where("status", "EQUAL", "active")
        .orderBy("name", "ASC")
        .limitResults(5);

      const snapshot = await execute(collection, criteria);
      const bounds = geohashQueryBounds(center, 1000);

      expect(snapshot.docs.map((doc) => doc.id)).toEqual(["near"]);
      expect(snapshot.size).toBe(1);
      expect(snapshot.empty).toBe(false);
      expect(collection.issued).toEqual(
        bounds.map(([start, end]) => [
          ["where", "status", "==", "active"],
          ["orderBy", "location_geohash"],
          ["startAt", start],
          ["endAt", end],
          ["orderBy", "name", "asc"],
          ["limit", 5],
        ]),
      );
    });

    it("deduplicates documents returned by several bounds", async () => {
      const collection = new FakeCollection("places", docs);
      const ids: string[] = [];

      const snapshot = await execute(
        collection,
        new Criteria().where("location", "GEO_RADIUS", { center, radiusInM: 1000 }),
      );
      snapshot.forEach((doc) => ids.push(doc.id));

      expect(collection.issued.length).toBeGreaterThan(1);
      expect(ids).toEqual(["near"]);
    });

    it.each<[string, GeoRadiusFilterValue]>([
      ["an inline point and a radius in km", { lat: 0, lng: 0, radiusInKm: 200 }],
      ["a { latitude, longitude } center and radiusMeters", { center: { latitude: 0, longitude: 0 }, radiusMeters: 200_000 }],
      ["an inline { lat, lon } point and radius", { lat: 0, lon: 0, radius: 200_000 }],
    ])("accepts %s", async (_description, value) => {
      const collection = new FakeCollection("places", docs);

      const snapshot = await execute(collection, new Criteria().where("location", "GEO_RADIUS", value));

      expect(snapshot.docs.map((doc) => doc.id).sort()).toEqual(["far", "near"]);
    });

    it("throws OperatorNotValid when the value has no radius", async () => {
      const collection = new FakeCollection("places", docs);
      const criteria = new Criteria().where("location", "GEO_RADIUS", { center } as unknown as GeoRadiusFilterValue);

      await expect(execute(collection, criteria)).rejects.toBeInstanceOf(OperatorNotValid);
      expect(collection.issued).toHaveLength(0);
    });

    it("reads every bound through the transaction when one is given", async () => {
      const collection = new FakeCollection("places", docs);
      const transaction = fakeTransaction();
      const uow = new FirestoreTransactionUnitOfWork(asFirestore<Transaction>(transaction));

      await execute(collection, new Criteria().where("location", "GEO_RADIUS", { center, radiusInM: 1000 }), uow);

      expect(transaction.get).toHaveBeenCalledTimes(geohashQueryBounds(center, 1000).length);
    });
  });
});
