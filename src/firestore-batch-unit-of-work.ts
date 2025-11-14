import { Firestore, WriteBatch, DocumentReference, DocumentData } from "firebase-admin/firestore";
import { UnitOfWork } from "@schorts/shared-kernel";

import { TransactionNotActive } from "./exceptions";

export class FirestoreBatchUnitOfWork implements UnitOfWork {
  private readonly firestore: Firestore;
  private batch: WriteBatch;
  private active = false;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.batch = firestore.batch();
  }

  async begin(): Promise<void> {
    this.active = true;
  }

  async commit(): Promise<void> {
    if (!this.active) {
      throw new TransactionNotActive();
    }

    await this.batch.commit();
    
    this.active = false;
  }

  async rollback(): Promise<void> {
    this.batch = this.firestore.batch();
    this.active = false;
  }

  create(docRef: DocumentReference, data: DocumentData): void {
    this.batch.set(docRef, data);
  }

  update(docRef: DocumentReference, data: DocumentData): void {
    this.batch.update(docRef, data);
  }

  delete(docRef: DocumentReference): void {
    this.batch.delete(docRef);
  }
}

