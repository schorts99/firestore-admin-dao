import { DocumentSnapshot } from "firebase-admin/firestore";
import { EntityRegistry, type Logger } from "@schorts/shared-kernel";

import { FirestoreTypesToPrimitivesFormatter } from "./firestore-types-to-primitives-formatter";

export class FirestoreEntityFactory<Entity> {
  constructor(
    private readonly collectionName: string,
    private readonly logger?: Logger,
  ) {}

  fromSnapshot(docSnap: DocumentSnapshot): Entity | null {
    this.logger?.debug("[FirestoreEntityFactory fromSnapshot] started", {
      docSnap,
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
      entity,
    });

    return entity as Entity;
  }

  fromSnapshots(docs: DocumentSnapshot[]): Entity[] {
    this.logger?.debug("[FirestoreEntityFactory fromSnapshots] started", {
      docs,
    });

    const entities = docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromSnapshot(doc)!)
      .filter(Boolean);

    this.logger?.debug("[FirestoreEntityFactory fromSnapshots] completed", {
      entities,
    });
    
    return entities;
  }
}

