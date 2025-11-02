import { Firestore, DocumentReference, DocumentData, DocumentSnapshot, QuerySnapshot, Query } from 'firebase-admin/firestore';
import { UnitOfWork } from '@schorts/shared-kernel';
export declare class FirestoreTransactionUnitOfWork implements UnitOfWork {
    private readonly firestore;
    private transaction;
    private active;
    constructor(firestore: Firestore);
    begin(): Promise<void>;
    private resolveTransaction;
    private rejectTransaction;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    set(docRef: DocumentReference, data: DocumentData): void;
    update(docRef: DocumentReference, data: DocumentData): void;
    delete(docRef: DocumentReference): void;
    get(docRef: DocumentReference): Promise<DocumentSnapshot>;
    getQuery(query: Query): Promise<QuerySnapshot>;
}
//# sourceMappingURL=firestore-transaction-unit-of-work.d.ts.map