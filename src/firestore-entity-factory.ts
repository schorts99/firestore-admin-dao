import { DocumentSnapshot } from "firebase-admin/firestore";
import { EntityRegistry, type Logger } from "@schorts/shared-kernel";

import { FirestoreTypesToPrimitivesFormatter } from "./firestore-types-to-primitives-formatter";
import { entityId, entityIds } from "./log-context";

export class FirestoreEntityFactory<Entity> {
  constructor(
    private readonly collectionName: string,
    private readonly logger?: Logger,
  ) {}

  fromSnapshot(docSnap: DocumentSnapshot): Entity | null {
    this.logger?.debug("[FirestoreEntityFactory fromSnapshot] started", {
      id: docSnap.id,
      exists: docSnap.exists,
    });

    if (!docSnap.exists) {
      return null;
    }

    const data = FirestoreTypesToPrimitivesFormatter.format(docSnap.data()!);

    this.logger?.debug("[FirestoreEntityFactory fromSnapshot] formatting data", {
      data,
    });

    const entity = EntityRegistry.fromPrimitives(this.collectionName, { id: docSnap.id, ...data });

    this.logger?.debug("[FirestoreEntityFactory fromSnapshot] completed", {
      entityId: entityId(entity),
    });

    return entity as Entity;
  }

  fromSnapshots(docs: DocumentSnapshot[]): Entity[] {
    this.logger?.debug("[FirestoreEntityFactory fromSnapshots] started", {
      size: docs.length,
    });

    const entities = docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromSnapshot(doc)!)
      .filter(Boolean);

    this.logger?.debug("[FirestoreEntityFactory fromSnapshots] completed", {
      entityIds: entityIds(entities),
    });
    
    return entities;
  }
}

