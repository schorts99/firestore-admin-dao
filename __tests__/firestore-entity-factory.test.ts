import type { DocumentSnapshot } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { EntityRegistry, InMemoryLogger } from "@schorts/shared-kernel";

import { FirestoreEntityFactory } from "../src/firestore-entity-factory";
import { asFirestore, FakeDocumentReference, FakeDocumentSnapshot } from "./helpers/fake-firestore";
import { registerUserEntity, storedUser, UserEntity, USERS } from "./helpers/user";

function snapshot(id: string, data?: Record<string, unknown>): DocumentSnapshot {
  return asFirestore(new FakeDocumentSnapshot(id, data, new FakeDocumentReference(id, {})));
}

describe("FirestoreEntityFactory", () => {
  beforeAll(registerUserEntity);
  afterAll(() => EntityRegistry.unregister(USERS));

  const factory = new FirestoreEntityFactory<UserEntity>(USERS, new InMemoryLogger("debug"));

  describe("#fromSnapshot", () => {
    it("returns null for a missing document", () => {
      expect(factory.fromSnapshot(snapshot("missing"))).toBeNull();
    });

    it("builds the registered entity with the document ID and formatted data", () => {
      const createdAt = new Date("2026-02-03T04:05:06.000Z");
      const user = factory.fromSnapshot(snapshot("user-1", storedUser({ created_at: Timestamp.fromDate(createdAt) })));

      expect(user).toBeInstanceOf(UserEntity);
      expect(user!.id.value).toBe("user-1");
      expect(user!.name).toBe("Ada");
      expect(user!.createdAt).toEqual(createdAt);
    });
  });

  describe("#fromSnapshots", () => {
    it("skips missing documents", () => {
      const users = factory.fromSnapshots([
        snapshot("user-1", storedUser()),
        snapshot("missing"),
        snapshot("user-2", storedUser()),
      ]);

      expect(users.map((user) => user.id.value)).toEqual(["user-1", "user-2"]);
    });
  });
});
