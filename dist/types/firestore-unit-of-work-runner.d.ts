import { Firestore } from "firebase-admin/firestore";
import { UnitOfWorkRunner } from "@schorts/shared-kernel";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";
export declare class FirestoreUnitOfWorkRunner implements UnitOfWorkRunner {
    private readonly firestore;
    constructor(firestore: Firestore);
    run<T>(operation: (uow: FirestoreTransactionUnitOfWork) => Promise<T>): Promise<T>;
}
//# sourceMappingURL=firestore-unit-of-work-runner.d.ts.map