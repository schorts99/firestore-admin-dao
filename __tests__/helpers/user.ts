import { CoordinatesValue, Entity, EntityRegistry, StringValue } from "@schorts/shared-kernel";

export type UserModel = {
  id: string;
  name: string;
  created_at: string;
  location: { latitude: number; longitude: number };
  deleted_at: string | null;
};

export class UserIDValue extends StringValue {
  readonly attributeName = "id";
}

export class LocationValue extends CoordinatesValue {
  readonly attributeName = "location";
}

export class UserEntity extends Entity<UserIDValue, UserModel> {
  constructor(
    id: UserIDValue,
    readonly name: string,
    readonly createdAt: Date,
    readonly location: LocationValue,
    public deletedAt: Date | null = null,
  ) {
    super(id);
  }

  toPrimitives(): UserModel {
    return {
      id: this.id.value,
      name: this.name,
      created_at: this.createdAt.toISOString(),
      location: this.location.value,
      deleted_at: this.deletedAt?.toISOString() ?? null,
    };
  }
}

export const USERS = "users";

export function registerUserEntity(): void {
  EntityRegistry.register<UserModel, UserEntity>(USERS, (model) =>
    new UserEntity(
      new UserIDValue(model.id),
      model.name,
      new Date(model.created_at),
      new LocationValue(model.location),
      model.deleted_at ? new Date(model.deleted_at) : null,
    ),
  );
}

export function buildUser(id = "user-1"): UserEntity {
  return new UserEntity(
    new UserIDValue(id),
    "Ada",
    new Date("2026-01-01T00:00:00.000Z"),
    new LocationValue({ latitude: 19.4326, longitude: -99.1332 }),
  );
}

export function storedUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Ada",
    created_at: "2026-01-01T00:00:00.000Z",
    location: { latitude: 19.4326, longitude: -99.1332 },
    deleted_at: null,
    ...overrides,
  };
}
