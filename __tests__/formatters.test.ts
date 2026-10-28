import { Timestamp } from "firebase-admin/firestore";
import { geohashForLocation } from "geofire-common";
import { DateValue } from "@schorts/shared-kernel";

import { FirestoreTypesToPrimitivesFormatter } from "../src/firestore-types-to-primitives-formatter";
import { PrimitiveTypesToFirestoreFormatter } from "../src/primitive-types-to-firestore-formatter";
import { EntityFirestoreFactory } from "../src/entity-firestore-factory";
import { buildUser, LocationValue } from "./helpers/user";

class BirthdayValue extends DateValue<false> {
  readonly attributeName = "birthday";
}

describe("FirestoreTypesToPrimitivesFormatter", () => {
  it("converts timestamps to ISO strings and keeps other values", () => {
    const date = new Date("2026-03-04T05:06:07.000Z");
    const formatted = FirestoreTypesToPrimitivesFormatter.format({
      created_at: Timestamp.fromDate(date),
      name: "Ada",
      count: 3,
    });

    expect(formatted).toEqual({ created_at: date.toISOString(), name: "Ada", count: 3 });
  });

  it("does not mutate the input", () => {
    const data = { created_at: Timestamp.fromDate(new Date()) };

    FirestoreTypesToPrimitivesFormatter.format(data);

    expect(data.created_at).toBeInstanceOf(Timestamp);
  });
});

describe("PrimitiveTypesToFirestoreFormatter", () => {
  describe("#formatCoordinates", () => {
    it("adds a snake_case geohash field per coordinates value", () => {
      const point = { latitude: 19.4326, longitude: -99.1332 };
      const formatted = PrimitiveTypesToFirestoreFormatter.formatCoordinates({
        _homeLocation: new LocationValue(point),
        name: "Ada",
      });

      expect(formatted).toEqual({
        home_location_geohash: geohashForLocation([point.latitude, point.longitude]),
      });
    });
  });

  describe("#formatDates", () => {
    it("converts Date and DateValue fields to snake_case timestamps", () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const birthday = new Date("1990-05-06T00:00:00.000Z");
      const formatted = PrimitiveTypesToFirestoreFormatter.formatDates({
        createdAt,
        _birthday: new BirthdayValue(birthday),
      });

      expect(Object.keys(formatted).sort()).toEqual(["birthday", "created_at"]);
      expect(formatted["created_at"]!.toDate()).toBe(createdAt);
      expect(formatted["birthday"]!.toDate()).toEqual(birthday);
    });

    it("skips empty DateValues", () => {
      expect(
        PrimitiveTypesToFirestoreFormatter.formatDates({ birthday: new BirthdayValue(null, undefined, undefined, true) }),
      ).toEqual({});
    });
  });

  it("#format merges coordinates and dates", () => {
    const formatted = PrimitiveTypesToFirestoreFormatter.format(buildUser());

    expect(Object.keys(formatted).sort()).toEqual(["created_at", "location_geohash"]);
  });
});

describe("EntityFirestoreFactory", () => {
  it("builds document data from the entity primitives without the id", () => {
    const user = buildUser();
    const data = EntityFirestoreFactory.fromEntity(user);

    expect(data["id"]).toBeUndefined();
    expect(data["name"]).toBe("Ada");
    expect(data["location"]).toEqual(user.location.value);
    expect(data["created_at"]).toBeInstanceOf(Timestamp);
    expect(data["created_at"].toDate()).toBe(user.createdAt);
    expect(data["location_geohash"]).toBe(geohashForLocation([19.4326, -99.1332]));
  });
});
