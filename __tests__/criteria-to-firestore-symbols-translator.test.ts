import { Timestamp } from "firebase-admin/firestore";
import { Operator, Order } from "@schorts/shared-kernel";

import {
  CriteriaToFirestoreSymbolsTranslator,
  OperatorNotValid,
  OrderNotValid,
} from "../src";

describe('CriteriaToFirestoreSymbolsTranslator', () => {
  describe('#translateOperator', () => {
    const cases: [Operator, string][] = [
      ["EQUAL", "=="],
      ["NOT_EQUAL", "!="],
      ["GREATER_THAN", ">"],
      ["GREATER_THAN_OR_EQUAL", ">="],
      ["LESS_THAN", "<"],
      ["LESS_THAN_OR_EQUAL", "<="],
      ["IN", "in"],
      ["NOT_IN", "not-in"],
    ];

    it.each(cases)("translates %s to %s", (input, expected) => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateOperator(input)).toBe(expected);
    });
  
    it("throws OperatorNotValid for unknown operator", () => {
      expect(() => CriteriaToFirestoreSymbolsTranslator.translateOperator("UNKNOWN" as Operator)).toThrow(OperatorNotValid);
      expect(() => CriteriaToFirestoreSymbolsTranslator.translateOperator("UNKNOWN" as Operator)).toThrow('operator: UNKNOWN');
    });
  });

  describe('#translatetranslateOrderDirectionOrder', () => {
    const cases: [Order["direction"], string | undefined][] = [
      ["ASC", "asc"],
      ["DESC", "desc"],
      ["NONE", undefined],
    ];
  
    it.each(cases)("translates %s to %s", (input, expected) => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateOrderDirection(input)).toBe(expected);
    });
  
    it("throws OrderNotValid for unknown direction", () => {
      expect(() => CriteriaToFirestoreSymbolsTranslator.translateOrderDirection("INVALID" as Order["direction"])).toThrow(OrderNotValid);
      expect(() => CriteriaToFirestoreSymbolsTranslator.translateOrderDirection("INVALID" as Order["direction"])).toThrow("order: INVALID");
    });
  });

  describe('#translateField', () => {
    it('returns documentId() when field is "id"', () => {
      const result = CriteriaToFirestoreSymbolsTranslator.translateField("id");
  
      expect(result).toEqual("__mocked_document_id__");
    });
  
    it("returns the field name for non-id fields", () => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateField("name")).toBe("name");
      expect(CriteriaToFirestoreSymbolsTranslator.translateField("email")).toBe("email");
      expect(CriteriaToFirestoreSymbolsTranslator.translateField("created_at")).toBe("created_at");
    });
  });

  describe('#translateValue', () => {
    it("translates Date to Timestamp", () => {
      const date = new Date("2023-01-01T00:00:00Z");
      const result = CriteriaToFirestoreSymbolsTranslator.translateValue(date);
  
      expect(result).toEqual({ __timestamp: true, date });
    });
  
    it("returns non-Date values unchanged", () => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateValue("hello")).toBe("hello");
      expect(CriteriaToFirestoreSymbolsTranslator.translateValue(42)).toBe(42);
      expect(CriteriaToFirestoreSymbolsTranslator.translateValue(null)).toBeNull();
      expect(CriteriaToFirestoreSymbolsTranslator.translateValue({ foo: "bar" })).toEqual({ foo: "bar" });
    });
  });
});
