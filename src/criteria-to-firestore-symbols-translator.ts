import { FieldPath, Timestamp, WhereFilterOp, OrderByDirection } from "firebase-admin/firestore";
import { Operator, Order } from "@schorts/shared-kernel";

import { OperatorNotValid, OrderNotValid } from "./exceptions";

export class CriteriaToFirestoreSymbolsTranslator {
  static translateOperator(operator: Operator): WhereFilterOp {
    switch (operator) {
      case "EQUAL":
        return "==";
      case "NOT_EQUAL":
        return "!=";
      case "GREATER_THAN":
        return ">";
      case "GREATER_THAN_OR_EQUAL":
        return ">=";
      case "LESS_THAN":
        return "<";
      case "LESS_THAN_OR_EQUAL":
        return "<=";
      case "IN":
        return "in";
      case "NOT_IN":
        return "not-in";
      default:
        throw new OperatorNotValid(`operator: ${operator}`);
    }
  }

  static translateOrderDirection(order: Order["direction"]): OrderByDirection | undefined {
    switch (order) {
      case "ASC":
        return "asc";
      case "DESC":
        return "desc";
      case "NONE":
        return undefined;
      default:
        throw new OrderNotValid(`order: ${order}`);
    }
  }

  static translateField(field: string): string | FieldPath {
    switch (field) {
      case "id":
        return FieldPath.documentId();
      default:
        return field;
    }
  }

  static translateValue(value: any): any {
    if (value instanceof Date) {
      return Timestamp.fromDate(value);
    }

    return value;
  }
}

