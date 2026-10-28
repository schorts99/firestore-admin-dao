import type { CollectionReference, WriteBatch } from "firebase-admin/firestore";

import { DataMigrator } from "../src/data-migrator";
import { asFirestore, mockedWriteBatch, FakeCollection, RecordingLogger } from "./helpers/fake-firestore";

describe("DataMigrator", () => {
  describe("#migrateFromHardToSoftDelete", () => {
    function setup(docs: Record<string, Record<string, unknown>>) {
      const collection = new FakeCollection("users", docs);
      const batch = mockedWriteBatch();
      collection.firestore.batch.mockReturnValue(batch);
      const migrator = new DataMigrator(asFirestore<CollectionReference>(collection), new RecordingLogger());

      return { batch, migrator };
    }

    it("adds the missing soft delete fields in one batch", async () => {
      const { batch, migrator } = setup({
        legacy: { name: "Ada" },
        partial: { name: "Grace", is_deleted: true },
        migrated: { name: "Linus", is_deleted: false, deleted_at: null },
      });

      await migrator.migrateFromHardToSoftDelete();

      expect(batch.update).toHaveBeenCalledTimes(2);
      expect(batch.update).toHaveBeenCalledWith(expect.objectContaining({ id: "legacy" }), {
        is_deleted: false,
        deleted_at: null,
      });
      expect(batch.update).toHaveBeenCalledWith(expect.objectContaining({ id: "partial" }), { deleted_at: null });
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it("reads and commits one page at a time", async () => {
      const collection = new FakeCollection("users", {
        a: { name: "A" },
        b: { name: "B", is_deleted: false, deleted_at: null },
        c: { name: "C", is_deleted: false, deleted_at: null },
        d: { name: "D", is_deleted: false, deleted_at: null },
        e: { name: "E" },
      });
      const batches: WriteBatch[] = [];
      collection.firestore.batch.mockImplementation(() => {
        const batch = mockedWriteBatch();
        batches.push(batch);
        return batch;
      });

      await new DataMigrator(asFirestore<CollectionReference>(collection), undefined, 2).migrateFromHardToSoftDelete();

      expect(collection.issued).toEqual([
        [["orderBy", "__mocked_document_id__"], ["limit", 2]],
        [["orderBy", "__mocked_document_id__"], ["limit", 2], ["startAfter", expect.objectContaining({ id: "b" })]],
        [["orderBy", "__mocked_document_id__"], ["limit", 2], ["startAfter", expect.objectContaining({ id: "d" })]],
      ]);
      const updated = batches.flatMap((batch) => (batch.update as jest.Mock).mock.calls.map(([ref]) => ref.id));
      expect(updated).toEqual(["a", "e"]);
      expect(batches.map((batch) => (batch.commit as jest.Mock).mock.calls.length)).toEqual([1, 1]);
    });

    it("stops after a full last page", async () => {
      const collection = new FakeCollection("users", { a: {}, b: {} });
      collection.firestore.batch.mockImplementation(() => mockedWriteBatch());

      await new DataMigrator(asFirestore<CollectionReference>(collection), undefined, 2).migrateFromHardToSoftDelete();

      expect(collection.issued).toHaveLength(2);
    });

    it("never reads pages larger than a Firestore batch", async () => {
      const collection = new FakeCollection("users");

      await new DataMigrator(asFirestore<CollectionReference>(collection), undefined, 10_000).migrateFromHardToSoftDelete();

      expect(collection.issued[0]).toEqual([["orderBy", "__mocked_document_id__"], ["limit", 500]]);
    });

    it("commits nothing for an empty collection", async () => {
      const { batch, migrator } = setup({});

      await migrator.migrateFromHardToSoftDelete();

      expect(batch.update).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
    });
  });
});
