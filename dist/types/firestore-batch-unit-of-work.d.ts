import { Firestore, DocumentReference, DocumentData } from "firebase-admin/firestore";
import { UnitOfWork } from "@schorts/shared-kernel";
export declare class FirestoreBatchUnitOfWork implements UnitOfWork {
    private readonly firestore;
    private batch;
    private active;
    constructor(firestore: Firestore);
    begin(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    create(docRef: DocumentReference, data: DocumentData): void;
    update(docRef: DocumentReference, data: DocumentData): void;
    delete(docRef: DocumentReference): void;
}
//# sourceMappingURL=firestore-batch-unit-of-work.d.ts.map