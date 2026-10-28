# Mapping rules

How `FirestoreDAO` turns entities into documents and back. Applies to entities stored in Firestore and their models.

## Writing

The DAO builds the document from the entity:

1. `entity.toPrimitives()`, without the `id` key. The document ID is `entity.id.value` (numbers are converted with `toString()`).
2. For each **own property of the entity** (not of the model):
   - a `Date`, or a `DateValue` with a value, is written as a Firestore `Timestamp`;
   - a `CoordinatesValue` adds a `<key>_geohash` field, used by `GEO_RADIUS` queries.

   `<key>` is the property name without a leading `_`, in snake_case: `publishedAt` and `_publishedAt` both become `published_at`, and `location` stays `location`.
3. Step 2 overwrites step 1 on matching keys. Name date and coordinate properties so their snake_case key is the model field. Otherwise the document gets both the model's string and an extra `Timestamp` field.
4. In `"SOFT"` delete mode, the DAO adds `is_deleted` and `deleted_at` (see [soft-delete.md](soft-delete.md)).

Only top-level entity properties are converted. Dates inside nested objects or arrays stay whatever `toPrimitives()` returned, usually ISO strings.

## Reading

The DAO converts top-level `Timestamp` fields to ISO strings, adds `id` (the document ID), and calls `EntityRegistry.fromPrimitives(collection.path, data)`. So:

- `fromPrimitives`/`restoreFromPrimitives` receive dates as ISO strings. Parse them with `new Date(value)` or `DateValue.fromPrimitives`.
- The model keeps coordinates as `{ latitude, longitude }`, and documents also carry `<key>_geohash`. Extra fields such as `<key>_geohash`, `is_deleted`, and `deleted_at` are passed in too, so ignore fields you do not model.
- Register the entity under the exact collection path before the first read. Otherwise `EntityRegistry.fromPrimitives` throws.

```ts
// file: places/place.ts
import { Entity } from "@schorts/shared-kernel/entities";
import { CoordinatesValue, DateValue, UUIDValue } from "@schorts/shared-kernel/value-objects";

export class PlaceId extends UUIDValue {
  readonly attributeName = "placeId";
}

export class PlaceLocation extends CoordinatesValue {
  readonly attributeName = "location";
}

export class OpenedAt extends DateValue {
  readonly attributeName = "openedAt";
}

// Keys are the snake_case names of the entity properties below.
export type PlaceModel = {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
  opened_at: string;
};

export class Place extends Entity<PlaceId, PlaceModel> {
  constructor(
    id: PlaceId,
    public name = "",
    public location = new PlaceLocation({ latitude: 0, longitude: 0 }),
    public openedAt = new OpenedAt(new Date(0)),
  ) {
    super(id);
  }

  toPrimitives(): PlaceModel {
    return {
      id: this.id.value,
      name: this.name,
      location: this.location.value,
      opened_at: this.openedAt.value.toISOString(),
    };
  }

  protected override createId(rawId: unknown): PlaceId {
    return new PlaceId(String(rawId));
  }

  protected override restoreFromPrimitives(data: PlaceModel): void {
    this.name = data.name;
    this.location = new PlaceLocation(data.location);
    this.openedAt = new OpenedAt(new Date(data.opened_at));
  }
}
```

Stored document: `{ name, location: { latitude, longitude }, location_geohash: "9g3w…", opened_at: Timestamp }`.

## Registration

- Register once at startup, before any DAO reads: `EntityRegistry.register("places", Place)`. A factory `(model) => entity` works too.
- `EntityRegistry` is global. Guard repeated registration with `EntityRegistry.has(path)` when a module can be loaded more than once.
- For a subcollection, register each concrete path the DAO is built for (`orgs/${orgId}/members`), for example in the DAO constructor:

```ts
// file: orgs/member-dao.ts
import { EntityRegistry, FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { Entity } from "@schorts/shared-kernel/entities";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class MemberId extends UUIDValue {
  readonly attributeName = "memberId";
}

export type MemberModel = { id: string; role: string };

export class Member extends Entity<MemberId, MemberModel> {
  constructor(id: MemberId, public role = "viewer") {
    super(id);
  }

  toPrimitives(): MemberModel {
    return { id: this.id.value, role: this.role };
  }

  protected override createId(rawId: unknown): MemberId {
    return new MemberId(String(rawId));
  }

  protected override restoreFromPrimitives(data: MemberModel): void {
    this.role = data.role;
  }
}

export class MemberDAO extends FirestoreDAO<MemberModel, Member> {
  constructor(members: CollectionReference) {
    if (!EntityRegistry.has(members.path)) {
      EntityRegistry.register(members.path, Member);
    }

    super(members);
  }
}
```

## Do not

- Do not store the ID inside the document as well; the DAO strips `id` and puts it back from the document ID.
- Do not keep `Timestamp`, `GeoPoint`, or `DocumentReference` values in models. Models hold primitives; the DAO converts dates and coordinates for you.
- Do not rely on `toPrimitives()` key order or on fields the DAO adds (`<key>_geohash`, `is_deleted`, `deleted_at`) being absent.
