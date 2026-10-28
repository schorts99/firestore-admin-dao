import { Firestore, WriteBatch, DocumentReference, DocumentData } from "firebase-admin/firestore";
import { UnitOfWork, type Logger } from "@schorts/shared-kernel";

import { TransactionNotActive } from "./exceptions";

export class FirestoreBatchUnitOfWork implements UnitOfWork {
  private readonly firestore: Firestore;
  private batch: WriteBatch;
  private active = false;
  private logger: Logger | undefined;

  constructor(firestore: Firestore, logger?: Logger) {
    this.firestore = firestore;
    this.batch = firestore.batch();
    this.logger = logger;
  }

  isActive(): boolean {
    return this.active;
  }

  async begin(): Promise<void> {
    this.logger?.debug("[FirestoreBatchUnitOfWork begin] started");

    this.active = true;

    this.logger?.debug("[FirestoreBatchUnitOfWork begin] completed");
  }

  async commit(): Promise<void> {
    this.logger?.debug("[FirestoreBatchUnitOfWork commit] started", {
      active: this.active,
    });

    if (!this.isActive()) {
      throw new TransactionNotActive();
    }

    this.logger?.debug("[FirestoreBatchUnitOfWork commit] committing batch");

    await this.batch.commit();
    
    this.active = false;

    this.logger?.debug("[FirestoreBatchUnitOfWork commit] completed", {
      active: this.active,
    });
  }

  async rollback(): Promise<void> {
    this.logger?.debug("[FirestoreBatchUnitOfWork rollback] started");

    this.batch = this.firestore.batch();
    this.active = false;

    this.logger?.debug("[FirestoreBatchUnitOfWork rollback] completed", {
      active: this.active,
    });
  }

  create(docRef: DocumentReference, data: DocumentData): void {
    this.logger?.debug("[FirestoreBatchUnitOfWork create] started", {
      path: docRef.path,
      data,
    });

    this.batch.create(docRef, data);

    this.logger?.debug("[FirestoreBatchUnitOfWork create] completed");
  }

  update(docRef: DocumentReference, data: DocumentData): void {
    this.logger?.debug("[FirestoreBatchUnitOfWork update] started", {
      path: docRef.path,
      data,
    });

    this.batch.update(docRef, data);

    this.logger?.debug("[FirestoreBatchUnitOfWork update] completed");
  }

  delete(docRef: DocumentReference): void {
    this.logger?.debug("[FirestoreBatchUnitOfWork delete] started", {
      path: docRef.path,
    });

    this.batch.delete(docRef);

    this.logger?.debug("[FirestoreBatchUnitOfWork delete] completed");
  }
}
