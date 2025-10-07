import { FieldPath, WhereFilterOp, OrderByDirection } from "firebase-admin/firestore";
import { Operator, Order } from "@schorts/shared-kernel";
export declare class CriteriaToFirestoreSymbolsTranslator {
    static translateOperator(operator: Operator): WhereFilterOp;
    static translateOrderDirection(order: Order["direction"]): OrderByDirection | undefined;
    static translateField(field: string): string | FieldPath;
    static translateValue(value: any): any;
}
//# sourceMappingURL=criteria-to-firestore-symbols-translator.d.ts.map