import { Timestamp } from "firebase-admin/firestore";
import { Geohash, geohashForLocation } from "geofire-common";
import { CoordinatesValue, PascalCamelToSnake } from "@schorts/shared-kernel";

export class PrimitiveTypesToFirestoreFormatter {
  static format<Entity>(entity: Entity): Record<string, unknown> {
    return {
      ...this.formatCoordinates(entity),
      ...this.formatDates(entity),
    };
  }

  static formatCoordinates<Entity>(entity: Entity): Record<string, Geohash> {
    const geoData: Record<string, Geohash> = {};

    for (const key in entity) {
      if (!Object.prototype.hasOwnProperty.call(entity, key)) continue;

      const value = (entity as any)[key];
      if (value instanceof CoordinatesValue) {
        const snakeKey = PascalCamelToSnake.format(key);
        geoData[`${snakeKey}_geohash`] = geohashForLocation([
          value.value.latitude,
          value.value.longitude,
        ]);
      }
    }

    return geoData;
  }

  static formatDates<Entity>(entity: Entity): Record<string, Timestamp> {
    const formattedDates: Record<string, Timestamp> = {};

    for (const key in entity) {
      if (!Object.prototype.hasOwnProperty.call(entity, key)) continue;

      const value = (entity as any)[key];
      if (value instanceof Date) {
        const snakeKey = PascalCamelToSnake.format(key);
        formattedDates[snakeKey] = Timestamp.fromDate(value);
      }
    }

    return formattedDates;
  }
}

