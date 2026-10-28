---
name: create-firestore-dao
description: Store a @schorts/shared-kernel entity in a Firestore collection with @schorts/firestore-admin-dao — model and entity whose dates and coordinates map to Timestamps and geohashes, a FirestoreDAO subclass, entity registration under the collection path, Firebase Admin setup, criteria queries, and an emulator test. Use when persisting a new entity in Firestore from server code.
---

# Create a Firestore DAO

This skill stores products in a `products` collection. It assumes you know kernel entities and value objects (`node_modules/@schorts/shared-kernel/ai/skills/create-value-object`).

## 1. The model and the entity

- Model keys are the stored field names. Use snake_case and name entity properties so their snake_case form matches (`publishedAt` ↔ `published_at`): the DAO converts `Date`/`DateValue` properties to `Timestamp`s under that key.
- Dates arrive in `restoreFromPrimitives` as ISO strings.
- Implement `createId` and `restoreFromPrimitives` so the kernel's `Product.fromPrimitives` can rebuild the entity.

```ts
// file: catalog/product.ts
import { Entity } from "@schorts/shared-kernel/entities";
import { DateValue, UUIDValue } from "@schorts/shared-kernel/value-objects";

export class ProductId extends UUIDValue {
  readonly attributeName = "productId";
}

export class PublishedAt extends DateValue {
  readonly attributeName = "publishedAt";
}

export type ProductModel = {
  id: string;
  name: string;
  price: number;
  tags: string[];
  published_at: string;
};

export class Product extends Entity<ProductId, ProductModel> {
  constructor(
    id: ProductId,
    public name = "",
    public price = 0,
    public tags: string[] = [],
    public publishedAt = new PublishedAt(new Date()),
  ) {
    super(id);
  }

  toPrimitives(): ProductModel {
    return {
      id: this.id.value,
      name: this.name,
      price: this.price,
      tags: [...this.tags],
      published_at: this.publishedAt.value.toISOString(),
    };
  }

  protected override createId(rawId: unknown): ProductId {
    return new ProductId(String(rawId));
  }

  protected override restoreFromPrimitives(data: ProductModel): void {
    this.name = data.name;
    this.price = data.price;
    this.tags = [...data.tags];
    this.publishedAt = new PublishedAt(new Date(data.published_at));
  }
}
```

## 2. The DAO

- Subclass `FirestoreDAO<Model, Entity>`. The constructor takes the collection, the delete mode, and an optional logger.
- Add domain queries as methods that build `Criteria`. Callers should not need to know field names.

```ts
// file: catalog/product-dao.ts
import { FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { Criteria } from "@schorts/shared-kernel/criteria";
import type { Logger } from "@schorts/shared-kernel/logger";
import type { Product, ProductModel } from "./product.js";

export const PRODUCTS = "products";

export class ProductDAO extends FirestoreDAO<ProductModel, Product> {
  constructor(collection: CollectionReference, logger?: Logger) {
    super(collection, "HARD", logger);
  }

  findCheapestTagged(tag: string, limit = 20): Promise<Product[]> {
    return this.search(
      Criteria.none()
        .where("tags", "ARRAY_CONTAINS", tag)
        .orderBy("price", "ASC")
        .limitResults(limit),
    );
  }

  findPublishedBetween(from: Date, to: Date): Promise<Product[]> {
    return this.search(
      Criteria.none()
        .where("published_at", "GREATER_THAN_OR_EQUAL", from)
        .where("published_at", "LESS_THAN", to)
        .orderBy("published_at", "DESC"),
    );
  }
}
```

`findCheapestTagged` filters on `tags` and orders by `price`, so it needs a composite index. Add it to `firestore.indexes.json` (Firestore's error message links to it the first time the query runs):

```json
{
  "indexes": [
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "price", "order": "ASCENDING" }
      ]
    }
  ]
}
```

## 3. Wire it up

- Initialize Firebase Admin once. With no arguments, `initializeApp()` uses Application Default Credentials (or the emulator when `FIRESTORE_EMULATOR_HOST` is set). Pass `{ credential: cert(serviceAccount) }` to use a key file.
- Register the entity under the collection path before the first read.

```ts
// file: catalog/bootstrap.ts
import { EntityRegistry, getApps, getFirestore, initializeApp } from "@schorts/firestore-admin-dao";
import type { Logger } from "@schorts/shared-kernel/logger";
import { Product } from "./product.js";
import { PRODUCTS, ProductDAO } from "./product-dao.js";

export function createCatalog(logger?: Logger) {
  const app = getApps()[0] ?? initializeApp();
  const firestore = getFirestore(app);

  if (!EntityRegistry.has(PRODUCTS)) {
    EntityRegistry.register(PRODUCTS, Product);
  }

  return { firestore, products: new ProductDAO(firestore.collection(PRODUCTS), logger) };
}
```

## 4. Use it

```ts
// file: catalog/publish-product.ts
import { randomUUID } from "node:crypto";
import { Product, ProductId } from "./product.js";
import type { ProductDAO } from "./product-dao.js";

export async function publishProduct(products: ProductDAO, input: { name: string; price: number; tags: string[] }) {
  const product = new Product(new ProductId(randomUUID()), input.name, input.price, input.tags);

  // create fails if the ID exists; save creates or updates.
  return products.create(product);
}
```

Other methods: `findByID(id)`, `findOneBy(criteria)`, `getAll()`, `count()`, `countBy(criteria)`, `exists(criteria)`, `update(entity)`, `save(entity)`, `saveMany(entities)`, `delete(entity)`, `deleteByID(id)`. Each takes an optional unit of work (see [use-firestore-transactions](../use-firestore-transactions/SKILL.md)).

## 5. Test it against the emulator

See [test-firestore-daos](../test-firestore-daos/SKILL.md) for the setup. A round trip proves the mapping:

```ts
// file: catalog/product-dao.test.ts
import { EntityRegistry, getApps, getFirestore, initializeApp, Timestamp } from "@schorts/firestore-admin-dao";
import { Product, ProductId, PublishedAt } from "./product.js";
import { PRODUCTS, ProductDAO } from "./product-dao.js";

const host = process.env["FIRESTORE_EMULATOR_HOST"];
const projectId = "demo-test";
const describeWithEmulator = host ? describe : describe.skip;

describeWithEmulator("ProductDAO", () => {
  const firestore = getFirestore(getApps()[0] ?? initializeApp({ projectId }));
  const products = new ProductDAO(firestore.collection(PRODUCTS));

  beforeAll(() => EntityRegistry.register(PRODUCTS, Product));
  afterAll(() => EntityRegistry.unregister(PRODUCTS));
  beforeEach(async () => {
    await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  });

  it("round-trips a product, storing the publish date as a Timestamp", async () => {
    const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const publishedAt = new Date("2026-03-01T10:00:00.000Z");
    await products.create(new Product(new ProductId(id), "Lamp", 40, ["home"], new PublishedAt(publishedAt)));

    const stored = (await firestore.collection(PRODUCTS).doc(id).get()).data();
    expect(stored?.["id"]).toBeUndefined();
    expect(stored?.["published_at"]).toBeInstanceOf(Timestamp);

    const found = await products.findByID(id);
    expect(found).toBeInstanceOf(Product);
    expect(found?.name).toBe("Lamp");
    expect(found?.publishedAt.value).toEqual(publishedAt);
  });

  it("finds the cheapest products with a tag", async () => {
    await products.create(new Product(new ProductId("0b1f7f4e-8f2e-4c1a-9d6b-3a5c2e1f0a11"), "Mug", 12, ["kitchen"]));
    await products.create(new Product(new ProductId("1c2a8e5f-9a3f-4d2b-8e7c-4b6d3f2a1b22"), "Pan", 30, ["kitchen"]));

    const found = await products.findCheapestTagged("kitchen");

    expect(found.map(product => product.name)).toEqual(["Mug", "Pan"]);
  });
});
```

## Checklist

- [ ] Model keys are the snake_case names of the entity's date and coordinate properties.
- [ ] `restoreFromPrimitives` parses ISO date strings.
- [ ] Entity registered under the exact collection path before the first read.
- [ ] Composite indexes for queries that mix fields are in `firestore.indexes.json`.
- [ ] Only operators Firestore supports (no `LIKE`, no `BETWEEN`).
- [ ] An emulator test round-trips an entity and runs each custom query.
