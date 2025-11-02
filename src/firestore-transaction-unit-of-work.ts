import {
  Firestore,
  Transaction,
  DocumentReference,
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
  Query,
  CollectionReference,
} from 'firebase-admin/firestore';
import { UnitOfWork } from '@schorts/shared-kernel';

import { TransactionNotActive, TransactionRollback } from './exceptions';

export class FirestoreTransactionUnitOfWork implements UnitOfWork {
  private readonly firestore: Firestore;
  private transaction: Transaction | null = null;
  private active = false;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async begin(): Promise<void> {
    if (this.active) return;

    await this.firestore.runTransaction(async (tx) => {
      this.transaction = tx;
      this.active = true;

      await new Promise<void>((resolve, reject) => {
        this.resolveTransaction = resolve;
        this.rejectTransaction = reject;
      });
    });

    this.active = false;
    this.transaction = null;
  }

  private resolveTransaction: (() => void) | null = null;
  private rejectTransaction: ((reason?: any) => void) | null = null;

  async commit(): Promise<void> {
    if (!this.active || !this.resolveTransaction) {
      throw new TransactionNotActive();
    }

    this.resolveTransaction();
  }

  async rollback(): Promise<void> {
    if (!this.active || !this.rejectTransaction) {
      throw new TransactionNotActive();
    }

    this.rejectTransaction(new TransactionRollback());
  }

  set(docRef: DocumentReference, data: DocumentData): void {
    if (!this.transaction) throw new TransactionNotActive();

    this.transaction.set(docRef, data);
  }

  update(docRef: DocumentReference, data: DocumentData): void {
    if (!this.transaction) throw new TransactionNotActive();

    this.transaction.update(docRef, data);
  }

  delete(docRef: DocumentReference): void {
    if (!this.transaction) throw new TransactionNotActive();

    this.transaction.delete(docRef);
  }

  get(docRef: DocumentReference): Promise<DocumentSnapshot> {
    if (!this.transaction) throw new TransactionNotActive();

    return this.transaction.get(docRef);
  }

  getQuery(query: Query): Promise<QuerySnapshot> {
    if (!this.transaction) throw new TransactionNotActive();

    return this.transaction.get(query);
  }
}
