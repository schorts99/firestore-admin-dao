---
name: add-geo-search
description: Find Firestore documents within a distance of a point with @schorts/firestore-admin-dao — a CoordinatesValue property that makes the DAO store a geohash, a GEO_RADIUS criteria query combined with other filters, in-memory ordering and paging, indexes, and cost limits. Use when adding "near me", radius, or distance search to an entity stored with FirestoreDAO.
---

# Add geo search

This skill finds open stores near a customer. Read [create-firestore-dao](../create-firestore-dao/SKILL.md) first.

## 1. Store coordinates as a `CoordinatesValue`

The DAO writes `<key>_geohash` next to the coordinates for every `CoordinatesValue` property of the entity. The property's snake_case name must be the model field you query (`location` here).

```ts
// file: stores/store.ts
import { Entity } from "@schorts/shared-kernel/entities";
import { CoordinatesValue, UUIDValue } from "@schorts/shared-kernel/value-objects";

export class StoreId extends UUIDValue {
  readonly attributeName = "storeId";
}

export class StoreLocation extends CoordinatesValue {
  readonly attributeName = "location";
}

export type StoreModel = {
  id: string;
  name: string;
  open: boolean;
  rating: number;
  location: { latitude: number; longitude: number };
};

export class Store extends Entity<StoreId, StoreModel> {
  constructor(
    id: StoreId,
    public name = "",
    public open = true,
    public rating = 0,
    public location = new StoreLocation({ latitude: 0, longitude: 0 }),
  ) {
    super(id);
  }

  toPrimitives(): StoreModel {
    return {
      id: this.id.value,
      name: this.name,
      open: this.open,
      rating: this.rating,
      location: this.location.value,
    };
  }

  protected override createId(rawId: unknown): StoreId {
    return new StoreId(String(rawId));
  }

  protected override restoreFromPrimitives(data: StoreModel): void {
    this.name = data.name;
    this.open = data.open;
    this.rating = data.rating;
    this.location = new StoreLocation(data.location);
  }
}
```

Stored document: `{ name, open, rating, location: { latitude, longitude }, location_geohash: "9g3qx…" }`. Documents written before the entity had the property have no geohash and are never found: re-save them once (`saveMany(await getAll())` on a small collection, or a paged job).

## 2. Query by radius

- `.where("location", "GEO_RADIUS", { center: [lat, lng], radiusInKm })`. The center can also be `{ latitude, longitude }` or inline `lat`/`lng`; the radius can be `radiusInM`, `radius`, `radiusMeters`, or `radiusInKm`.
- Other filters run in Firestore. Orders, offset, and limit run in memory on the documents inside the radius, so you can order by any field without an index for it.
- Every document inside the geohash ranges is read, even with `limitResults`. Cap the radius.

```ts
// file: stores/store-dao.ts
import { FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { Criteria } from "@schorts/shared-kernel/criteria";
import type { Store, StoreModel } from "./store.js";

export const STORES = "stores";
const MAX_RADIUS_KM = 25;

export class StoreDAO extends FirestoreDAO<StoreModel, Store> {
  constructor(collection: CollectionReference) {
    super(collection);
  }

  findOpenNear(point: { latitude: number; longitude: number }, radiusInKm: number, limit = 10): Promise<Store[]> {
    return this.search(
      Criteria.none()
        .where("location", "GEO_RADIUS", {
          center: [point.latitude, point.longitude],
          radiusInKm: Math.min(radiusInKm, MAX_RADIUS_KM),
        })
        .where("open", "EQUAL", true)
        .orderBy("rating", "DESC")
        .limitResults(limit),
    );
  }

  countNear(point: { latitude: number; longitude: number }, radiusInKm: number): Promise<number> {
    return this.countBy(
      Criteria.none().where("location", "GEO_RADIUS", {
        center: [point.latitude, point.longitude],
        radiusInKm: Math.min(radiusInKm, MAX_RADIUS_KM),
      }),
    );
  }
}
```

Results are not sorted by distance unless you order by something else; to sort by distance, compute it from `store.location` after the query.

## 3. Indexes

Each geohash range query orders by `location_geohash` and keeps the other filters. Equality filters plus that order need a composite index:

```json
{
  "indexes": [
    {
      "collectionGroup": "stores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "open", "order": "ASCENDING" },
        { "fieldPath": "location_geohash", "order": "ASCENDING" }
      ]
    }
  ]
}
```

In `"SOFT"` delete mode, add `is_deleted` as the first field. Avoid range filters (`GREATER_THAN`, …) on other fields in a geo query; filter those in memory instead.

## 4. Test it

Run against the emulator (see [test-firestore-daos](../test-firestore-daos/SKILL.md)). Cover a document just inside and just outside the radius, the extra filter, and the order:

```ts
// file: stores/store-dao.test.ts
import { EntityRegistry, getApps, getFirestore, initializeApp } from "@schorts/firestore-admin-dao";
import { Store, StoreId, StoreLocation } from "./store.js";
import { STORES, StoreDAO } from "./store-dao.js";

const host = process.env["FIRESTORE_EMULATOR_HOST"];
const projectId = "demo-test";
const describeWithEmulator = host ? describe : describe.skip;

describeWithEmulator("StoreDAO.findOpenNear", () => {
  const firestore = getFirestore(getApps()[0] ?? initializeApp({ projectId }));
  const stores = new StoreDAO(firestore.collection(STORES));
  const center = { latitude: 19.4326, longitude: -99.1332 };

  function store(id: string, name: string, open: boolean, rating: number, latitudeOffset: number) {
    return new Store(
      new StoreId(id),
      name,
      open,
      rating,
      new StoreLocation({ latitude: center.latitude + latitudeOffset, longitude: center.longitude }),
    );
  }

  beforeAll(() => EntityRegistry.register(STORES, Store));
  afterAll(() => EntityRegistry.unregister(STORES));
  beforeEach(async () => {
    await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  });

  it("returns open stores inside the radius, best rated first", async () => {
    await stores.saveMany([
      store("3f1e1c1a-0000-4000-8000-000000000001", "Near, good", true, 4.8, 0.01),
      store("3f1e1c1a-0000-4000-8000-000000000002", "Near, ok", true, 3.9, 0.02),
      store("3f1e1c1a-0000-4000-8000-000000000003", "Near, closed", false, 5, 0.01),
      store("3f1e1c1a-0000-4000-8000-000000000004", "Far", true, 5, 0.5),
    ]);

    const found = await stores.findOpenNear(center, 5);

    expect(found.map(s => s.name)).toEqual(["Near, good", "Near, ok"]);
  });
});
```

## Checklist

- [ ] The entity property is a `CoordinatesValue` whose snake_case name is the queried field.
- [ ] Existing documents re-saved so they have `<field>_geohash`.
- [ ] Radius capped; no `limitResults` relied on to bound reads.
- [ ] Composite index on the equality filters plus `<field>_geohash` (and `is_deleted` in `"SOFT"` mode).
- [ ] One `GEO_RADIUS` filter per criteria.
