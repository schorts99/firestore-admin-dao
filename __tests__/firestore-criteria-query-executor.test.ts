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

      await execute(collection, criteria);

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
        .where("status", "EQUAL", "active");

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

    describe("ordering and paging", () => {
      const places = {
        a: { location: { latitude: 0.001, longitude: 0 }, rank: 3, name: "Alpha" },
        b: { location: { latitude: 0.002, longitude: 0 }, rank: 1, name: "Bravo" },
        c: { location: { latitude: 0.003, longitude: 0 }, name: "Charlie" },
        d: { location: { latitude: 0.004, longitude: 0 }, rank: 2, name: "Delta" },
        far: { location: { latitude: 1, longitude: 0 }, rank: 0, name: "Far" },
      };
      const nearby = () => new Criteria().where("location", "GEO_RADIUS", { center, radiusInM: 1000 });

      async function ids(criteria: Criteria) {
        const snapshot = await execute(new FakeCollection("places", places), criteria);

        return snapshot.docs.map((doc) => doc.id);
      }

      it("does not push orders, offset or limit into the bound queries", async () => {
        const collection = new FakeCollection("places", places);

        await execute(collection, nearby().orderBy("rank").limitResults(1).offsetResults(1));

        for (const calls of collection.issued) {
          expect(calls.map(([method]) => method)).toEqual(["orderBy", "startAt", "endAt"]);
        }
      });

      it("sorts the merged results, with missing values last", async () => {
        await expect(ids(nearby().orderBy("rank", "ASC"))).resolves.toEqual(["b", "d", "a", "c"]);
        await expect(ids(nearby().orderBy("rank", "DESC"))).resolves.toEqual(["a", "d", "b", "c"]);
      });

      it("sorts by several fields and by id", async () => {
        const tied = { ...places, b: { ...places.b, rank: 3 } };
        const snapshot = await execute(
          new FakeCollection("places", tied),
          nearby().orderBy("rank", "DESC").orderBy("id", "DESC"),
        );

        expect(snapshot.docs.map((doc) => doc.id)).toEqual(["b", "a", "d", "c"]);
      });

      it("sorts timestamps and dates chronologically", async () => {
        const dated = {
          a: { location: places.a.location, at: Timestamp.fromDate(new Date("2026-03-01")) },
          b: { location: places.b.location, at: new Date("2026-01-01") },
          c: { location: places.c.location, at: Timestamp.fromDate(new Date("2026-02-01")) },
        };
        const snapshot = await execute(new FakeCollection("places", dated), nearby().orderBy("at"));

        expect(snapshot.docs.map((doc) => doc.id)).toEqual(["b", "c", "a"]);
      });

      it("applies offset and limit to the merged results", async () => {
        await expect(ids(nearby().orderBy("name").offsetResults(1).limitResults(2))).resolves.toEqual(["b", "c"]);
        await expect(ids(nearby().orderBy("name").limitResults(3))).resolves.toEqual(["a", "b", "c"]);
        await expect(ids(nearby().orderBy("name").offsetResults(3))).resolves.toEqual(["d"]);
      });

      it("keeps the merged order when there are no orders", async () => {
        await expect(ids(nearby())).resolves.toEqual(["a", "b", "c", "d"]);
      });
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

  describe("#count", () => {
    function count(collection: FakeCollection, criteria: Criteria, uow?: FirestoreTransactionUnitOfWork) {
      return FirestoreCriteriaQueryExecutor.count(
        asFirestore<CollectionReference>(collection),
        criteria,
        uow,
        new RecordingLogger(),
      );
    }

    it("counts with an aggregate query", async () => {
      const collection = new FakeCollection("users", { a: {}, b: {} });

      await expect(count(collection, new Criteria().where("name", "EQUAL", "Ada"))).resolves.toBe(2);
      expect(collection.issued).toEqual([[["where", "name", "==", "Ada"], ["count"]]]);
    });

    it("counts through the transaction when one is given", async () => {
      const collection = new FakeCollection("users", { a: {} });
      const transaction = fakeTransaction();
      const uow = new FirestoreTransactionUnitOfWork(asFirestore<Transaction>(transaction));

      await expect(count(collection, new Criteria(), uow)).resolves.toBe(1);
      expect(transaction.get).toHaveBeenCalledTimes(1);
    });

    it("counts geo radius matches from the documents", async () => {
      const collection = new FakeCollection("places", {
        near: { location: { latitude: 0.001, longitude: 0 } },
        far: { location: { latitude: 1, longitude: 0 } },
      });

      await expect(
        count(collection, new Criteria().where("location", "GEO_RADIUS", { center: [0, 0], radiusInM: 1000 })),
      ).resolves.toBe(1);
      expect(collection.issued.flat().some(([method]) => method === "count")).toBe(false);
    });
  });
});
