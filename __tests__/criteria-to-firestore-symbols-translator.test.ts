import { Timestamp } from "firebase-admin/firestore";
import type { Operator, Order } from "@schorts/shared-kernel";

import { CriteriaToFirestoreSymbolsTranslator } from "../src/criteria-to-firestore-symbols-translator";
import { OperatorNotValid, OrderNotValid } from "../src/exceptions";

describe("CriteriaToFirestoreSymbolsTranslator", () => {
  describe("#translateOperator", () => {
    it.each<[Operator, string]>([
      ["EQUAL", "=="],
      ["NOT_EQUAL", "!="],
      ["GREATER_THAN", ">"],
      ["GREATER_THAN_OR_EQUAL", ">="],
      ["LESS_THAN", "<"],
      ["LESS_THAN_OR_EQUAL", "<="],
      ["IN", "in"],
      ["NOT_IN", "not-in"],
      ["ARRAY_CONTAINS", "array-contains"],
      ["ARRAY_CONTAINS_ANY", "array-contains-any"],
    ])("translates %s to %s", (operator, expected) => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateOperator(operator)).toBe(expected);
    });

    it.each<Operator>(["LIKE", "BETWEEN", "GEO_RADIUS"])("throws OperatorNotValid for %s", (operator) => {
      expect(() => CriteriaToFirestoreSymbolsTranslator.translateOperator(operator)).toThrow(OperatorNotValid);
    });
  });

  describe("#translateOrderDirection", () => {
    it("translates ASC and DESC", () => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateOrderDirection("ASC")).toBe("asc");
      expect(CriteriaToFirestoreSymbolsTranslator.translateOrderDirection("DESC")).toBe("desc");
    });

    it("returns undefined for NONE", () => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateOrderDirection("NONE")).toBeUndefined();
    });

    it("throws OrderNotValid for an unknown direction", () => {
      expect(() =>
        CriteriaToFirestoreSymbolsTranslator.translateOrderDirection("SIDEWAYS" as Order["direction"]),
      ).toThrow(OrderNotValid);
    });
  });

  describe("#translateField", () => {
    it("maps id to the document ID field path", () => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateField("id")).toBe("__mocked_document_id__");
    });

    it("keeps any other field as is", () => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateField("address.city")).toBe("address.city");
    });
  });

  describe("#translateValue", () => {
    it("converts dates to timestamps", () => {
      const date = new Date("2026-01-01T00:00:00.000Z");
      const value = CriteriaToFirestoreSymbolsTranslator.translateValue(date);

      expect(value).toBeInstanceOf(Timestamp);
      expect(value.toDate()).toBe(date);
    });

    it.each([["text"], [42], [true], [null], [["a", "b"]]])("keeps %p as is", (value) => {
      expect(CriteriaToFirestoreSymbolsTranslator.translateValue(value)).toBe(value);
    });
  });
});
