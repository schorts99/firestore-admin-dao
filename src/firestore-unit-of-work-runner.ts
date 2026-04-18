import { Firestore } from "firebase-admin/firestore";
import { UnitOfWorkRunner } from "@schorts/shared-kernel";

import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";

export class FirestoreUnitOfWorkRunner implements UnitOfWorkRunner {
  constructor(private readonly firestore: Firestore) {}

  async run<T>(operation: (uow: FirestoreTransactionUnitOfWork) => Promise<T>): Promise<T> {
    return this.firestore.runTransaction(async (tx) => {
      const uow = new FirestoreTransactionUnitOfWork(tx);

      return await operation(uow);
    });
  }
}
