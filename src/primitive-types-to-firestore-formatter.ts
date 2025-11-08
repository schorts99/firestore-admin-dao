import { Timestamp } from "firebase-admin/firestore";
import { Geohash, geohashForLocation } from "geofire-common";
import { CoordinatesValue, PascalCamelToSnake, DateValue } from "@schorts/shared-kernel";

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
        const formattedKey = key.startsWith('_') ? key.substring(1) : key;
        const snakeKey = PascalCamelToSnake.format(formattedKey);
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
        const formattedKey = key.startsWith('_') ? key.substring(1) : key;
        const snakeKey = PascalCamelToSnake.format(formattedKey);
        formattedDates[snakeKey] = Timestamp.fromDate(value);
      } else if (value instanceof DateValue && value.value) {
        const formattedKey = key.startsWith('_') ? key.substring(1) : key;
        const snakeKey = PascalCamelToSnake.format(formattedKey);
        formattedDates[snakeKey] = Timestamp.fromDate(value.value);
      }
    }

    return formattedDates;
  }
}
