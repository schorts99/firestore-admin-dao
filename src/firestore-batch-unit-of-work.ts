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

  async begin(): Promise<void> {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreBatchUnitOfWork",
      method: "begin",
    }, { active: this.active });

    this.active = true;

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreBatchUnitOfWork",
      method: "begin",
    }, { active: this.active });
  }

  async commit(): Promise<void> {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreBatchUnitOfWork",
      method: "commit",
    }, { active: this.active });

    if (!this.active) {
      throw new TransactionNotActive();
    }

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreBatchUnitOfWork",
      method: "commit",
    }, { batch: this.batch });

    await this.batch.commit();
    
    this.active = false;

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreBatchUnitOfWork",
      method: "commit",
    }, { active: this.active });
  }

  async rollback(): Promise<void> {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreBatchUnitOfWork",
      method: "rollback",
    }, { active: this.active, batch: this.batch });

    this.batch = this.firestore.batch();
    this.active = false;

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreBatchUnitOfWork",
      method: "rollback",
    }, { active: this.active, batch: this.batch });
  }

  create(docRef: DocumentReference, data: DocumentData): void {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreBatchUnitOfWork",
      method: "create",
    }, { batch: this.batch });

    this.batch.set(docRef, data);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreBatchUnitOfWork",
      method: "create",
    }, { batch: this.batch });
  }

  update(docRef: DocumentReference, data: DocumentData): void {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreBatchUnitOfWork",
      method: "update",
    }, { batch: this.batch });

    this.batch.update(docRef, data);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreBatchUnitOfWork",
      method: "update",
    }, { batch: this.batch });
  }

  delete(docRef: DocumentReference): void {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreBatchUnitOfWork",
      method: "delete",
    }, { batch: this.batch });

    this.batch.delete(docRef);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreBatchUnitOfWork",
      method: "delete",
    }, { batch: this.batch });
  }
}

