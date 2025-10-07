import { expectTypeOf } from "expect-type";
import { CollectionReference, Firestore } from "firebase-admin/firestore";
import { Entity, UUIDValue, BaseModel, EntityRegistry } from "@schorts/shared-kernel";

import { FirestoreDAO } from "../src";

type UserModel = {
  id: string;
};

class IDValue extends UUIDValue {
  readonly attributeName = "ID";
}

class UserEntity extends Entity<IDValue, UserModel> {
  toPrimitives(): UserModel {
    return {
      id: this.id.value,
    };
  }

  static fromPrimitives<UserModel extends BaseModel>(model: UserModel): UserEntity {
    return new UserEntity(
      new IDValue(model.id as string),
    );
  }
}

EntityRegistry.register("users", UserEntity);

class UserDAO extends FirestoreDAO<UserModel, UserEntity> {
  constructor() {
    super(Object.create(Firestore.prototype), "users");
  }
}

describe("FirestoreDAO", () => {
  it('should define a property "collection" of type string', () => {
    expectTypeOf<FirestoreDAO<UserModel, UserEntity>["collection"]>().toEqualTypeOf<CollectionReference>();
  })

  describe('#findByID', () => {
    const dao = new UserDAO();

    it("should return a UserEntity when document exists", async () => {
      const result = await dao.findByID("abc123");
  
      expect(result).toBeInstanceOf(UserEntity);
    });
  });
});
