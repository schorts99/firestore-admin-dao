import { Timestamp } from "firebase-admin/firestore";
import { Geohash } from "geofire-common";
export declare class PrimitiveTypesToFirestoreFormatter {
    static format<Entity>(entity: Entity): Record<string, unknown>;
    static formatCoordinates<Entity>(entity: Entity): Record<string, Geohash>;
    static formatDates<Entity>(entity: Entity): Record<string, Timestamp>;
}
//# sourceMappingURL=primitive-types-to-firestore-formatter.d.ts.map