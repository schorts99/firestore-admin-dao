import { DocumentSnapshot } from "firebase-admin/firestore";
import { EntityRegistry, type Logger } from "@schorts/shared-kernel";

import { FirestoreTypesToPrimitivesFormatter } from "./firestore-types-to-primitives-formatter";

export class FirestoreEntityFactory<Entity> {
  constructor(
    private readonly collectionName: string,
    private readonly logger?: Logger,
  ) {}

  fromSnapshot(docSnap: DocumentSnapshot): Entity | null {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreEntityFactory",
      method: "fromSnapshot",
    }, { docSnap });

    if (!docSnap.exists) {
      return null;
    }

    const data = FirestoreTypesToPrimitivesFormatter.format(docSnap.data()!);

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreEntityFactory",
      method: "fromSnapshot",
    }, { data });

    const entity = EntityRegistry.create(this.collectionName, { id: docSnap.id, ...data });

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreEntityFactory",
      method: "fromSnapshot",
    }, { entity });

    return entity as Entity;
  }

  fromSnapshots(docs: DocumentSnapshot[]): Entity[] {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreEntityFactory",
      method: "fromSnapshots",
    }, { docs });

    const entities = docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromSnapshot(doc)!)
      .filter(Boolean);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreEntityFactory",
      method: "fromSnapshots",
    }, { entities });
    
    return entities;
  }
}

