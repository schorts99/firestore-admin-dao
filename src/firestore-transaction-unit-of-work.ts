import {
  Firestore,
  Transaction,
  DocumentReference,
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
  Query,
} from 'firebase-admin/firestore';
import { UnitOfWork } from '@schorts/shared-kernel';

export class FirestoreTransactionUnitOfWork implements UnitOfWork {
  constructor(private readonly transaction: Transaction) {}

  async begin(): Promise<void> {}

  async commit(): Promise<void> {}

  async rollback(): Promise<void> {
    throw new Error('Manual rollback not supported in Firestore transactions');
  }

  get(ref: DocumentReference): Promise<DocumentSnapshot> {
    return this.transaction.get(ref);
  }

  getQuery<T>(query: Query<T>): Promise<QuerySnapshot<T>> {
    return this.transaction.get(query);
  }

  set(docRef: DocumentReference, data: DocumentData): void {
    this.transaction.set(docRef, data);
  }

  update(docRef: DocumentReference, data: DocumentData): void {
    this.transaction.update(docRef, data);
  }

  delete(docRef: DocumentReference): void {
    this.transaction.delete(docRef);
  }
}
