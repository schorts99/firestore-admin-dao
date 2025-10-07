import { DocumentSnapshot } from "firebase-admin/firestore";
import { EntityRegistry } from "@schorts/shared-kernel";

import { FirestoreTypesToPrimitivesFormatter } from "./firestore-types-to-primitives-formatter";

export class FirestoreEntityFactory<Entity> {
  constructor(private readonly collectionName: string) {}

  fromSnapshot(docSnap: DocumentSnapshot): Entity | null {
    if (!docSnap.exists) {
      return null;
    }

    const data = FirestoreTypesToPrimitivesFormatter.format(docSnap.data()!);

    return EntityRegistry.create(this.collectionName, { id: docSnap.id, ...data }) as Entity;
  }

  fromSnapshots(docs: DocumentSnapshot[]): Entity[] {
    return docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromSnapshot(doc)!)
      .filter(Boolean);
  }
}

