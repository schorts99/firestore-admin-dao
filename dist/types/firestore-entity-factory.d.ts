import { DocumentSnapshot } from "firebase-admin/firestore";
export declare class FirestoreEntityFactory<Entity> {
    private readonly collectionName;
    constructor(collectionName: string);
    fromSnapshot(docSnap: DocumentSnapshot): Entity | null;
    fromSnapshots(docs: DocumentSnapshot[]): Entity[];
}
//# sourceMappingURL=firestore-entity-factory.d.ts.map