import { DocumentSnapshot } from "firebase-admin/firestore";
import { type Logger } from "@schorts/shared-kernel";
export declare class FirestoreEntityFactory<Entity> {
    private readonly collectionName;
    private readonly logger?;
    constructor(collectionName: string, logger?: Logger | undefined);
    fromSnapshot(docSnap: DocumentSnapshot): Entity | null;
    fromSnapshots(docs: DocumentSnapshot[]): Entity[];
}
//# sourceMappingURL=firestore-entity-factory.d.ts.map