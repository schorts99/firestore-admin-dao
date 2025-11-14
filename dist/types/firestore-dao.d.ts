import { CollectionReference } from "firebase-admin/firestore";
import { DAO, Model, ValueObject, Entity as BaseEntity, Criteria, Logger, DeleteMode } from "@schorts/shared-kernel";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";
export declare abstract class FirestoreDAO<M extends Model, Entity extends BaseEntity<ValueObject, M>> extends DAO<M, Entity> {
    private readonly collection;
    private readonly firestoreEntityFactory;
    private readonly logger;
    constructor(collection: CollectionReference, deleteMode: DeleteMode, logger?: Logger);
    findByID(id: Entity["id"]["value"], uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity | null>;
    findOneBy(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity | null>;
    getAll(uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity[]>;
    search(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity[]>;
    countBy(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<number>;
    create(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity>;
    update(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity>;
    delete(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity>;
}
//# sourceMappingURL=firestore-dao.d.ts.map