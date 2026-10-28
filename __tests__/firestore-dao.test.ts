import type { CollectionReference, Firestore, Transaction } from "firebase-admin/firestore";
import { Firestore as MockedFirestore, Timestamp } from "firebase-admin/firestore";
import { Criteria, EntityRegistry, type DeleteMode } from "@schorts/shared-kernel";

import { FirestoreDAO } from "../src/firestore-dao";
import { FirestoreBatchUnitOfWork } from "../src/firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "../src/firestore-transaction-unit-of-work";
import { EntityNotRecoverable } from "../src/exceptions";
import { asFirestore, FakeCollection, fakeTransaction, RecordingLogger, type StoredDocs } from "./helpers/fake-firestore";
import { buildUser, registerUserEntity, storedUser, UserEntity, USERS, type UserModel } from "./helpers/user";

class UserDAO extends FirestoreDAO<UserModel, UserEntity> {}

function setup(docs: StoredDocs = {}, deleteMode: DeleteMode = "HARD") {
  const collection = new FakeCollection(USERS, docs);
  const logger = new RecordingLogger();
  const dao = new UserDAO(asFirestore<CollectionReference>(collection), deleteMode, logger);

  return { collection, dao, logger };
}

function batchUnitOfWork(): FirestoreBatchUnitOfWork {
  const uow = new FirestoreBatchUnitOfWork(new MockedFirestore() as unknown as Firestore);

  jest.spyOn(uow, "create");
  jest.spyOn(uow, "update");
  jest.spyOn(uow, "delete");

  return uow;
}

function transactionUnitOfWork() {
  const transaction = fakeTransaction();

  return { transaction, uow: new FirestoreTransactionUnitOfWork(asFirestore<Transaction>(transaction)) };
}

const softDeletedUser = storedUser({ is_deleted: true, deleted_at: "2026-02-01T00:00:00.000Z" });

describe("FirestoreDAO", () => {
  beforeAll(registerUserEntity);
  afterAll(() => EntityRegistry.unregister(USERS));

  it("logs through the given logger", async () => {
    const { dao, logger } = setup({ "user-1": storedUser() });

    await dao.findByID("user-1");

    expect(logger.messages).toContain("[FirestoreDAO findByID] completed");
  });

  it("works without a logger", async () => {
    const dao = new UserDAO(asFirestore<CollectionReference>(new FakeCollection(USERS, { "user-1": storedUser() })));

    await expect(dao.findByID("user-1")).resolves.toBeInstanceOf(UserEntity);
  });

  describe("#findByID", () => {
    it("returns the entity when the document exists", async () => {
      const { dao } = setup({ "user-1": storedUser() });

      const user = await dao.findByID("user-1");

      expect(user).toBeInstanceOf(UserEntity);
      expect(user!.id.value).toBe("user-1");
      expect(user!.name).toBe("Ada");
    });

    it("returns null when the document does not exist", async () => {
      const { dao } = setup();

      await expect(dao.findByID("missing")).resolves.toBeNull();
    });

    it("reads through the transaction when one is given", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() });
      const { transaction, uow } = transactionUnitOfWork();

      await dao.findByID("user-1", uow);

      expect(transaction.get).toHaveBeenCalledWith(collection.doc("user-1"));
    });

    it("hides soft deleted documents unless asked for them", async () => {
      const { dao } = setup({ "user-1": softDeletedUser }, "SOFT");

      await expect(dao.findByID("user-1")).resolves.toBeNull();
      await expect(dao.findByID("user-1", undefined, true)).resolves.toBeInstanceOf(UserEntity);
    });

    it("returns soft deleted documents in HARD mode", async () => {
      const { dao } = setup({ "user-1": softDeletedUser });

      await expect(dao.findByID("user-1")).resolves.toBeInstanceOf(UserEntity);
    });
  });

  describe("#findOneBy", () => {
    it("limits the query to one result and returns the first entity", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() });

      const user = await dao.findOneBy(new Criteria().where("name", "EQUAL", "Ada"));

      expect(user!.id.value).toBe("user-1");
      expect(collection.issued[0]).toEqual([
        ["where", "name", "==", "Ada"],
        ["limit", 1],
      ]);
    });

    it("returns null when nothing matches", async () => {
      const { dao } = setup();

      await expect(dao.findOneBy(new Criteria())).resolves.toBeNull();
    });

    it("excludes soft deleted documents in SOFT mode unless asked for them", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() }, "SOFT");

      await dao.findOneBy(new Criteria());
      await dao.findOneBy(new Criteria(), undefined, true);

      expect(collection.issued).toEqual([
        [["where", "is_deleted", "==", false], ["limit", 1]],
        [["limit", 1]],
      ]);
    });
  });

  describe("#getAll", () => {
    it("returns every entity", async () => {
      const { collection, dao } = setup({ "user-1": storedUser(), "user-2": storedUser() });

      const users = await dao.getAll();

      expect(users.map((user) => user.id.value)).toEqual(["user-1", "user-2"]);
      expect(collection.issued[0]).toEqual([["limit", 1000]]);
    });

    it("returns an empty list for an empty collection", async () => {
      const { dao } = setup();

      await expect(dao.getAll()).resolves.toEqual([]);
    });

    it("excludes soft deleted documents in SOFT mode unless asked for them", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.getAll();
      await dao.getAll(undefined, true);

      expect(collection.issued).toEqual([
        [["limit", 1000], ["where", "is_deleted", "==", false]],
        [["limit", 1000]],
      ]);
    });

    it("reads through the transaction when one is given", async () => {
      const { dao } = setup({ "user-1": storedUser() });
      const { transaction, uow } = transactionUnitOfWork();

      await expect(dao.getAll(uow)).resolves.toHaveLength(1);
      expect(transaction.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("#search", () => {
    it("returns the matching entities", async () => {
      const { collection, dao } = setup({ "user-1": storedUser(), "user-2": storedUser() });

      const users = await dao.search(new Criteria().where("name", "EQUAL", "Ada").limitResults(2));

      expect(users).toHaveLength(2);
      expect(collection.issued[0]).toEqual([
        ["where", "name", "==", "Ada"],
        ["limit", 2],
      ]);
    });

    it("returns an empty list when nothing matches", async () => {
      const { dao } = setup();

      await expect(dao.search(new Criteria())).resolves.toEqual([]);
    });

    it("excludes soft deleted documents in SOFT mode unless asked for them", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.search(new Criteria());
      await dao.search(new Criteria(), undefined, true);

      expect(collection.issued).toEqual([[["where", "is_deleted", "==", false]], []]);
    });
  });

  describe("#count", () => {
    it("counts the documents", async () => {
      const { dao } = setup({ "user-1": storedUser(), "user-2": storedUser() });

      await expect(dao.count()).resolves.toBe(2);
    });

    it("excludes soft deleted documents in SOFT mode unless asked for them", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.count();
      await dao.count(undefined, true);

      expect(collection.issued).toEqual([
        [["limit", 1000], ["where", "is_deleted", "==", false]],
        [["limit", 1000]],
      ]);
    });

    it("reads through the transaction when one is given", async () => {
      const { dao } = setup({ "user-1": storedUser() });
      const { transaction, uow } = transactionUnitOfWork();

      await expect(dao.count(uow)).resolves.toBe(1);
      expect(transaction.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("#countBy", () => {
    it("counts the matching documents", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() });

      await expect(dao.countBy(new Criteria().where("name", "EQUAL", "Ada"))).resolves.toBe(1);
      expect(collection.issued[0]).toEqual([["where", "name", "==", "Ada"]]);
    });

    it("excludes soft deleted documents in SOFT mode unless asked for them", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.countBy(new Criteria());
      await dao.countBy(new Criteria(), undefined, true);

      expect(collection.issued).toEqual([[["where", "is_deleted", "==", false]], []]);
    });
  });

  describe("#create", () => {
    it("creates the document without the id", async () => {
      const { collection, dao } = setup();
      const user = buildUser();

      await expect(dao.create(user)).resolves.toBe(user);

      const data = collection.doc("user-1").create.mock.calls[0]![0];
      expect(data["id"]).toBeUndefined();
      expect(data["name"]).toBe("Ada");
      expect(data["created_at"]).toBeInstanceOf(Timestamp);
      expect(data).not.toHaveProperty("is_deleted");
    });

    it("adds the soft delete fields in SOFT mode", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.create(buildUser());

      expect(collection.doc("user-1").create).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: false, deleted_at: null }),
      );
    });

    it("queues the write on the unit of work when one is given", async () => {
      const { collection, dao } = setup();
      const uow = batchUnitOfWork();

      await dao.create(buildUser(), uow);

      expect(uow.create).toHaveBeenCalledWith(collection.doc("user-1"), expect.objectContaining({ name: "Ada" }));
      expect(collection.doc("user-1").create).not.toHaveBeenCalled();
    });
  });

  describe("#update", () => {
    it("updates the document", async () => {
      const { collection, dao } = setup();
      const user = buildUser();

      await expect(dao.update(user)).resolves.toBe(user);
      expect(collection.doc("user-1").update).toHaveBeenCalledWith(expect.objectContaining({ name: "Ada" }));
    });

    it("marks the document as not deleted in SOFT mode", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.update(buildUser());

      expect(collection.doc("user-1").update).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: false, deleted_at: null }),
      );
    });

    it("queues the write on the unit of work when one is given", async () => {
      const { collection, dao } = setup();
      const uow = batchUnitOfWork();

      await dao.update(buildUser(), uow);

      expect(uow.update).toHaveBeenCalledWith(collection.doc("user-1"), expect.objectContaining({ name: "Ada" }));
      expect(collection.doc("user-1").update).not.toHaveBeenCalled();
    });
  });

  describe("#delete", () => {
    it("removes the document in HARD mode", async () => {
      const { collection, dao } = setup();

      await dao.delete(buildUser());

      expect(collection.doc("user-1").delete).toHaveBeenCalledTimes(1);
    });

    it("flags the document as deleted in SOFT mode", async () => {
      const { collection, dao } = setup({}, "SOFT");

      await dao.delete(buildUser());

      const data = collection.doc("user-1").update.mock.calls[0]![0];
      expect(data["is_deleted"]).toBe(true);
      expect(data["deleted_at"]).toBeInstanceOf(Timestamp);
      expect(collection.doc("user-1").delete).not.toHaveBeenCalled();
    });

    it("queues a delete on the unit of work in HARD mode", async () => {
      const { collection, dao } = setup();
      const uow = batchUnitOfWork();

      await dao.delete(buildUser(), uow);

      expect(uow.delete).toHaveBeenCalledWith(collection.doc("user-1"));
    });

    it("queues an update on the unit of work in SOFT mode", async () => {
      const { collection, dao } = setup({}, "SOFT");
      const uow = batchUnitOfWork();

      await dao.delete(buildUser(), uow);

      expect(uow.update).toHaveBeenCalledWith(
        collection.doc("user-1"),
        expect.objectContaining({ is_deleted: true, deleted_at: expect.any(Timestamp) }),
      );
      expect(uow.delete).not.toHaveBeenCalled();
    });
  });

  describe("#exists", () => {
    it("is true when a document matches", async () => {
      const { dao } = setup({ "user-1": storedUser() });

      await expect(dao.exists(new Criteria().where("name", "EQUAL", "Ada"))).resolves.toBe(true);
    });

    it("is false when nothing matches", async () => {
      const { dao } = setup();

      await expect(dao.exists(new Criteria())).resolves.toBe(false);
    });

    it("excludes soft deleted documents in SOFT mode unless asked for them", async () => {
      const { collection, dao } = setup({ "user-1": softDeletedUser }, "SOFT");

      await dao.exists(new Criteria());
      await dao.exists(new Criteria(), undefined, true);

      expect(collection.issued).toEqual([
        [["where", "is_deleted", "==", false], ["limit", 1]],
        [["limit", 1]],
      ]);
    });
  });

  describe("#deleteByID", () => {
    it("deletes the document when it exists", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() });

      await dao.deleteByID("user-1");

      expect(collection.doc("user-1").delete).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the document does not exist", async () => {
      const { collection, dao } = setup();

      await dao.deleteByID("missing");

      expect(collection.doc("missing").delete).not.toHaveBeenCalled();
    });
  });

  describe("#save", () => {
    it("updates an existing document", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() });

      await dao.save(buildUser());

      expect(collection.doc("user-1").update).toHaveBeenCalledTimes(1);
      expect(collection.doc("user-1").create).not.toHaveBeenCalled();
    });

    it("creates a missing document", async () => {
      const { collection, dao } = setup();

      await dao.save(buildUser());

      expect(collection.doc("user-1").create).toHaveBeenCalledTimes(1);
      expect(collection.doc("user-1").update).not.toHaveBeenCalled();
    });

    it("updates a soft deleted document instead of recreating it", async () => {
      const { collection, dao } = setup({ "user-1": softDeletedUser }, "SOFT");

      await dao.save(buildUser());

      expect(collection.doc("user-1").update).toHaveBeenCalledWith(expect.objectContaining({ is_deleted: false }));
      expect(collection.doc("user-1").create).not.toHaveBeenCalled();
    });
  });

  describe("#saveMany", () => {
    it("saves every entity", async () => {
      const { collection, dao } = setup({ "user-1": storedUser() });
      const users = [buildUser("user-1"), buildUser("user-2")];

      await expect(dao.saveMany(users)).resolves.toEqual(users);
      expect(collection.doc("user-1").update).toHaveBeenCalledTimes(1);
      expect(collection.doc("user-2").create).toHaveBeenCalledTimes(1);
    });
  });

  describe("#restore", () => {
    it("throws EntityNotRecoverable in HARD mode", async () => {
      const { dao } = setup();

      await expect(dao.restore(buildUser())).rejects.toBeInstanceOf(EntityNotRecoverable);
    });

    it("clears the soft delete fields on the document and the entity", async () => {
      const { collection, dao } = setup({}, "SOFT");
      const user = buildUser();
      user.deletedAt = new Date("2026-02-01T00:00:00.000Z");

      const restored = await dao.restore(user);

      expect(restored.deletedAt).toBeNull();
      expect(collection.doc("user-1").update).toHaveBeenCalledWith(
        expect.objectContaining({ is_deleted: false, deleted_at: null }),
      );
    });

    it("queues the update on the unit of work when one is given", async () => {
      const { collection, dao } = setup({}, "SOFT");
      const uow = batchUnitOfWork();

      await dao.restore(buildUser(), uow);

      expect(uow.update).toHaveBeenCalledWith(
        collection.doc("user-1"),
        expect.objectContaining({ is_deleted: false, deleted_at: null }),
      );
      expect(collection.doc("user-1").update).not.toHaveBeenCalled();
    });
  });
});
