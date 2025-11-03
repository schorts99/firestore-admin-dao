"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimitiveTypesToFirestoreFormatter = void 0;
const firestore_1 = require("firebase-admin/firestore");
const geofire_common_1 = require("geofire-common");
const shared_kernel_1 = require("@schorts/shared-kernel");
class PrimitiveTypesToFirestoreFormatter {
    static format(entity) {
        return {
            ...this.formatCoordinates(entity),
            ...this.formatDates(entity),
        };
    }
    static formatCoordinates(entity) {
        const geoData = {};
        for (const key in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, key))
                continue;
            const value = entity[key];
            if (value instanceof shared_kernel_1.CoordinatesValue) {
                const formattedKey = key.startsWith('_') ? key.substring(1) : key;
                const snakeKey = shared_kernel_1.PascalCamelToSnake.format(formattedKey);
                geoData[`${snakeKey}_geohash`] = (0, geofire_common_1.geohashForLocation)([
                    value.value.latitude,
                    value.value.longitude,
                ]);
            }
        }
        return geoData;
    }
    static formatDates(entity) {
        const formattedDates = {};
        for (const key in entity) {
            if (!Object.prototype.hasOwnProperty.call(entity, key))
                continue;
            const value = entity[key];
            if (value instanceof Date) {
                const formattedKey = key.startsWith('_') ? key.substring(1) : key;
                const snakeKey = shared_kernel_1.PascalCamelToSnake.format(formattedKey);
                formattedDates[snakeKey] = firestore_1.Timestamp.fromDate(value);
            }
            else if (value instanceof shared_kernel_1.DateValue && value.value) {
                const formattedKey = key.startsWith('_') ? key.substring(1) : key;
                const snakeKey = shared_kernel_1.PascalCamelToSnake.format(formattedKey);
                formattedDates[snakeKey] = firestore_1.Timestamp.fromDate(value.value);
            }
        }
        return formattedDates;
    }
}
exports.PrimitiveTypesToFirestoreFormatter = PrimitiveTypesToFirestoreFormatter;
//# sourceMappingURL=primitive-types-to-firestore-formatter.js.map