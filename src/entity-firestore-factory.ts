import { DocumentData } from "firebase-admin/firestore";

import { PrimitiveTypesToFirestoreFormatter } from "./primitive-types-to-firestore-formatter";

export class EntityFirestoreFactory {
  static fromEntity<Entity extends { toPrimitives(): Record<string, any> }>(entity: Entity): DocumentData {
    const raw = {
      ...entity.toPrimitives(),
      ...PrimitiveTypesToFirestoreFormatter.format<Entity>(entity),
    };

    delete raw["id"];

    return raw;
  }
}

