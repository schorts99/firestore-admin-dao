# Querying rules

Applies to `findOneBy`, `search`, `countBy`, `exists`, and the reads behind `getAll`, `count`, and `findByID`.

## Criteria on Firestore

`FirestoreDAO` translates kernel `Criteria` into a Firestore query:

| Criteria | Firestore |
| --- | --- |
| `EQUAL` / `NOT_EQUAL` | `==` / `!=` |
| `GREATER_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL` | `>`, `>=`, `<`, `<=` |
| `IN` / `NOT_IN` | `in` / `not-in` |
| `ARRAY_CONTAINS` / `ARRAY_CONTAINS_ANY` | `array-contains` / `array-contains-any` |
| `GEO_RADIUS` | geohash range queries, then a distance filter (below) |
| `LIKE`, `BETWEEN` | not supported: throws `OperatorNotValid` |
| `orderBy(field, "ASC" \| "DESC")` | `orderBy(field, "asc" \| "desc")` |
| `limitResults` / `offsetResults` | `limit` / `offset` |

- Fields are stored field names (the model's keys), with dots for nested fields (`"address.city"`). `id` means the document ID.
- A `Date` value becomes a `Timestamp`. Dates inside an `IN`/`NOT_IN` array are not converted: pass `Timestamp.fromDate(date)` for each one.
- Write `BETWEEN` as two range filters on the same field:

```ts
import { Criteria } from "@schorts/shared-kernel/criteria";

const january = Criteria.none()
  .where("opened_at", "GREATER_THAN_OR_EQUAL", new Date("2026-01-01T00:00:00Z"))
  .where("opened_at", "LESS_THAN", new Date("2026-02-01T00:00:00Z"))
  .orderBy("opened_at", "ASC")
  .limitResults(50);
```

- For "contains" text search (`LIKE`), use a dedicated search service, or store a normalized array of tokens and use `ARRAY_CONTAINS`.

## Firestore's limits apply

- Queries that combine filters and orders on different fields need a composite index. Firestore's error message links to create it; add it to `firestore.indexes.json`.
- In `"SOFT"` mode every criteria query also filters `is_deleted == false`, so indexes for those queries must include `is_deleted`.
- `IN`, `NOT_IN`, and `ARRAY_CONTAINS_ANY` take at most 30 values. `!=` and `not-in` skip documents that lack the field.
- `offsetResults(n)` still reads, and bills, the skipped documents. Keep offsets small; for deep paging, filter on the last seen value (`GREATER_THAN` the previous page's last `opened_at`) instead.
- A `Criteria` with no filters reads the whole collection. `getAll()` returns every document, so do not call it on large collections.

## Geo radius

- `.where(field, "GEO_RADIUS", value)` accepts every shape the kernel accepts: `{ center: [lat, lng] }` or inline `lat`/`lng`, plus `radiusInM`, `radius`, `radiusMeters`, or `radiusInKm`. A value without a center or radius throws `OperatorNotValid`.
- Documents need `<field>_geohash`, which the DAO writes when the entity's `<field>` property is a `CoordinatesValue` (see [mapping.md](mapping.md)). Documents written without it are never found.
- The other filters are applied in Firestore; orders, offset, and limit are applied in memory after the distance filter. Every candidate inside the geohash ranges is read, even with `limitResults(1)`.
- Use one `GEO_RADIUS` filter per criteria.

## Counting and existence

- `count()` and `countBy(criteria)` run Firestore aggregate count queries: exact, and billed per 1,000 index entries rather than per document. `countBy` with `GEO_RADIUS` reads the candidate documents instead.
- `exists(criteria)` reads at most one document. Prefer it to `countBy(...) > 0`.
- `findOneBy` adds `limitResults(1)` itself.

## Soft delete in queries

Every read method takes `includeDeleted` after the unit of work: `search(criteria, undefined, true)`. In `"HARD"` mode it has no effect.
