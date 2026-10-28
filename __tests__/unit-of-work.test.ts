import type { DocumentReference, Firestore, Query, Transaction, WriteBatch } from "firebase-admin/firestore";
import { Firestore as MockedFirestore } from "firebase-admin/firestore";

import { FirestoreBatchUnitOfWork } from "../src/firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "../src/firestore-transaction-unit-of-work";
import { FirestoreUnitOfWorkRunner } from "../src/firestore-unit-of-work-runner";
import { TransactionNotActive } from "../src/exceptions";
import { asFirestore, mockedWriteBatch, fakeTransaction, RecordingLogger } from "./helpers/fake-firestore";

const docRef = asFirestore<DocumentReference>({ id: "doc-1" });

describe("FirestoreBatchUnitOfWork", () => {
  let firestore: Firestore;
  let batches: WriteBatch[];
  let uow: FirestoreBatchUnitOfWork;

  beforeEach(() => {
    batches = [];
    firestore = asFirestore<Firestore>({
      batch: jest.fn(() => {
        const batch = mockedWriteBatch();
        batches.push(batch);
        return batch;
      }),
    });
    uow = new FirestoreBatchUnitOfWork(firestore, new RecordingLogger());
  });

  it("is inactive until it begins", async () => {
    expect(uow.isActive()).toBe(false);

    await uow.begin();

    expect(uow.isActive()).toBe(true);
  });

  it("queues writes on the batch", () => {
    uow.create(docRef, { a: 1 });
    uow.update(docRef, { b: 2 });
    uow.delete(docRef);

    expect(batches[0]!.create).toHaveBeenCalledWith(docRef, { a: 1 });
    expect(batches[0]!.set).not.toHaveBeenCalled();
    expect(batches[0]!.update).toHaveBeenCalledWith(docRef, { b: 2 });
    expect(batches[0]!.delete).toHaveBeenCalledWith(docRef);
  });

  it("commits the batch and becomes inactive", async () => {
    await uow.begin();
    await uow.commit();

    expect(batches[0]!.commit).toHaveBeenCalledTimes(1);
    expect(uow.isActive()).toBe(false);
  });

  it("refuses to commit when it has not begun", async () => {
    await expect(uow.commit()).rejects.toBeInstanceOf(TransactionNotActive);
    expect(batches[0]!.commit).not.toHaveBeenCalled();
  });

  it("discards queued writes on rollback", async () => {
    await uow.begin();
    uow.create(docRef, { a: 1 });
    await uow.rollback();

    expect(uow.isActive()).toBe(false);
    expect(batches).toHaveLength(2);

    await uow.begin();
    await uow.commit();

    expect(batches[0]!.commit).not.toHaveBeenCalled();
    expect(batches[1]!.commit).toHaveBeenCalledTimes(1);
    expect(batches[1]!.create).not.toHaveBeenCalled();
  });

  it("works without a logger", async () => {
    const plain = new FirestoreBatchUnitOfWork(new MockedFirestore() as unknown as Firestore);

    await plain.begin();
    await expect(plain.commit()).resolves.toBeUndefined();
  });
});

describe("FirestoreTransactionUnitOfWork", () => {
  let transaction: ReturnType<typeof fakeTransaction>;
  let uow: FirestoreTransactionUnitOfWork;

  beforeEach(() => {
    transaction = fakeTransaction();
    uow = new FirestoreTransactionUnitOfWork(asFirestore<Transaction>(transaction));
  });

  it("is always active and begin/commit are no-ops", async () => {
    expect(uow.isActive()).toBe(true);
    await expect(uow.begin()).resolves.toBeUndefined();
    await expect(uow.commit()).resolves.toBeUndefined();
  });

  it("does not support manual rollback", async () => {
    await expect(uow.rollback()).rejects.toThrow("Manual rollback not supported");
  });

  it("reads documents and queries through the transaction", async () => {
    const snapshot = { exists: true };
    const ref = asFirestore<DocumentReference>({ get: jest.fn(async () => snapshot) });
    const query = asFirestore<Query>({ get: jest.fn(async () => ({ docs: [] })) });

    await expect(uow.get(ref)).resolves.toBe(snapshot);
    await expect(uow.getQuery(query)).resolves.toEqual({ docs: [] });
    expect(transaction.get).toHaveBeenCalledWith(ref);
    expect(transaction.get).toHaveBeenCalledWith(query);
  });

  it("counts a query's documents through the transaction", async () => {
    const countQuery = { get: jest.fn(async () => ({ data: () => ({ count: 7 }) })) };
    const query = asFirestore<Query>({ count: () => countQuery });

    await expect(uow.count(query)).resolves.toBe(7);
    expect(transaction.get).toHaveBeenCalledWith(countQuery);
  });

  it("writes through the transaction", () => {
    uow.create(docRef, { a: 1 });
    uow.update(docRef, { b: 2 });
    uow.delete(docRef);

    expect(transaction.create).toHaveBeenCalledWith(docRef, { a: 1 });
    expect(transaction.update).toHaveBeenCalledWith(docRef, { b: 2 });
    expect(transaction.delete).toHaveBeenCalledWith(docRef);
  });
});

describe("FirestoreUnitOfWorkRunner", () => {
  it("runs the operation inside a Firestore transaction", async () => {
    const transaction = fakeTransaction();
    const firestore = asFirestore<Firestore>({
      runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(transaction)),
    });
    const runner = new FirestoreUnitOfWorkRunner(firestore);

    const result = await runner.run(async (uow) => {
      expect(uow).toBeInstanceOf(FirestoreTransactionUnitOfWork);
      uow.delete(docRef);
      return "done";
    });

    expect(result).toBe("done");
    expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.delete).toHaveBeenCalledWith(docRef);
  });

  it("propagates errors from the operation", async () => {
    const firestore = asFirestore<Firestore>({
      runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTransaction())),
    });

    await expect(
      new FirestoreUnitOfWorkRunner(firestore).run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
