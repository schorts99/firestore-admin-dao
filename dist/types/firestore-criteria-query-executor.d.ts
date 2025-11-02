import { CollectionReference, QuerySnapshot } from "firebase-admin/firestore";
import { Criteria } from "@schorts/shared-kernel";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";
export declare class FirestoreCriteriaQueryExecutor {
    static execute(collection: CollectionReference, criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<QuerySnapshot>;
}
//# sourceMappingURL=firestore-criteria-query-executor.d.ts.map