import type { CollectionReference } from "firebase-admin/firestore";

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

    it("commits nothing for an empty collection", async () => {
      const { batch, migrator } = setup({});

      await migrator.migrateFromHardToSoftDelete();

      expect(batch.update).not.toHaveBeenCalled();
      expect(batch.commit).not.toHaveBeenCalled();
    });
  });
});
