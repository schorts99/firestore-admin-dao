import { CollectionReference } from "firebase-admin/firestore";
import { DAO, BaseModel, ValueObject, Entity as BaseEntity, Criteria } from "@schorts/shared-kernel";
import { FirestoreUnitOfWork } from "./firestore-unit-of-work";
export declare abstract class FirestoreDAO<Model extends BaseModel, Entity extends BaseEntity<ValueObject, Model>> implements DAO<Model, Entity> {
    private readonly collection;
    private readonly firestoreEntityFactory;
    constructor(collection: CollectionReference);
    findByID(id: Entity["id"]["value"]): Promise<Entity | null>;
    findOneBy(criteria: Criteria): Promise<Entity | null>;
    getAll(): Promise<Entity[]>;
    search(criteria: Criteria): Promise<Entity[]>;
    create(entity: Entity, uow?: FirestoreUnitOfWork): Promise<Entity>;
    update(entity: Entity, uow?: FirestoreUnitOfWork): Promise<Entity>;
    delete(entity: Entity, uow?: FirestoreUnitOfWork): Promise<Entity>;
}
//# sourceMappingURL=firestore-dao.d.ts.map