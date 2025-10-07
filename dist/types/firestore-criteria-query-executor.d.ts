import { CollectionReference, QuerySnapshot } from "firebase-admin/firestore";
import { Criteria } from "@schorts/shared-kernel";
export declare class FirestoreCriteriaQueryExecutor {
    static execute(collection: CollectionReference, criteria: Criteria): Promise<QuerySnapshot>;
}
//# sourceMappingURL=firestore-criteria-query-executor.d.ts.map