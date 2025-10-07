import { expectTypeOf } from "expect-type";
import { Firestore, WriteBatch } from "firebase-admin/firestore";

import { FirestoreUnitOfWork, TransactionNotActive } from "../src";

describe("FirestoreUnitOfWork", () => {
  it('should have a property "firestore" of type Firestore', () => {
    expectTypeOf<FirestoreUnitOfWork["firestore"]>().toEqualTypeOf<Firestore>();
  });

  it('should have a property "batch" of type WriteBatch', () => {
    expectTypeOf<FirestoreUnitOfWork["batch"]>().toEqualTypeOf<WriteBatch>();
  });

  it('should have a property "active" of type boolean', () => {
    expectTypeOf<FirestoreUnitOfWork["active"]>().toEqualTypeOf<boolean>();
  });

  describe('#begin', () => {
    it('should define the method', () => {
      expectTypeOf<FirestoreUnitOfWork>().toHaveProperty("begin");
      expectTypeOf<FirestoreUnitOfWork["begin"]>().toBeFunction();
    });

    it('should receive no params', () => {
      expectTypeOf<FirestoreUnitOfWork["begin"]>().parameters.toEqualTypeOf<[]>();
    });

    it('should return an empty Promise', () => {
      expectTypeOf<FirestoreUnitOfWork["begin"]>().returns.toEqualTypeOf<Promise<void>>();
    });
  });

  describe('#commit', () => {
    it('should define the method', () => {
      expectTypeOf<FirestoreUnitOfWork>().toHaveProperty("commit");
      expectTypeOf<FirestoreUnitOfWork["commit"]>().toBeFunction();
    });

    it('should receive no params', () => {
      expectTypeOf<FirestoreUnitOfWork["commit"]>().parameters.toEqualTypeOf<[]>();
    });

    it('should return an empty Promise', () => {
      expectTypeOf<FirestoreUnitOfWork["commit"]>().returns.toEqualTypeOf<Promise<void>>();
    });

    describe('begin has been called', () => {
      let firestoreUnitOfWork: FirestoreUnitOfWork;
      
      beforeEach(() => {
        firestoreUnitOfWork = new FirestoreUnitOfWork(Object.create(Firestore.prototype));

        firestoreUnitOfWork.begin();
      });

      it('should execute without exceptions', () => {
        expect(() => firestoreUnitOfWork.commit()).resolves.not.toThrow(TransactionNotActive);
      });
    });

    describe('begin has not been called', () => {
    let firestoreUnitOfWork: FirestoreUnitOfWork;
      
      beforeEach(() => {
        firestoreUnitOfWork = new FirestoreUnitOfWork(Object.create(Firestore.prototype));
      });

      it('should throw TransactionNotActive', () => {
        expect(() => firestoreUnitOfWork.commit()).rejects.toThrow(TransactionNotActive);
      });
    });
  });

  describe('#rollback', () => {
    it('should define the method', () => {
      expectTypeOf<FirestoreUnitOfWork>().toHaveProperty("rollback");
      expectTypeOf<FirestoreUnitOfWork["rollback"]>().toBeFunction();
    });

    it('should receive no params', () => {
      expectTypeOf<FirestoreUnitOfWork["rollback"]>().parameters.toEqualTypeOf<[]>();
    });

    it('should return an empty Promise', () => {
      expectTypeOf<FirestoreUnitOfWork["rollback"]>().returns.toEqualTypeOf<Promise<void>>();
    });
  });
});
