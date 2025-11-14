import { Transaction, DocumentReference, DocumentData, DocumentSnapshot, QuerySnapshot, Query } from 'firebase-admin/firestore';
import { UnitOfWork } from '@schorts/shared-kernel';
export declare class FirestoreTransactionUnitOfWork implements UnitOfWork {
    private readonly transaction;
    constructor(transaction: Transaction);
    begin(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    get(ref: DocumentReference): Promise<DocumentSnapshot>;
    getQuery<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
    create(docRef: DocumentReference, data: DocumentData): void;
    update(docRef: DocumentReference, data: DocumentData): void;
    delete(docRef: DocumentReference): void;
}
//# sourceMappingURL=firestore-transaction-unit-of-work.d.ts.map