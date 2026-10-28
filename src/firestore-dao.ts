import { CollectionReference, Query, Timestamp } from "firebase-admin/firestore";
import {
  DAO,
  Model,
  ValueObject,
  Entity as BaseEntity,
  Criteria,
  Logger,
  DeleteMode,
} from "@schorts/shared-kernel";

import { FirestoreCriteriaQueryExecutor } from "./firestore-criteria-query-executor.js";
import { FirestoreEntityFactory } from "./firestore-entity-factory.js";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work.js";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work.js";
import { EntityFirestoreFactory } from "./entity-firestore-factory.js";
import { EntityNotRecoverable } from "./exceptions/index.js";
import { entityId, entityIds, unitOfWorkKind } from "./log-context.js";

export abstract class FirestoreDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>
> extends DAO<M, Entity> {
  private readonly collection: CollectionReference;
  private readonly firestoreEntityFactory: FirestoreEntityFactory<Entity>;
  private readonly logger: Logger | undefined;

  constructor(collection: CollectionReference, deleteMode: DeleteMode = "HARD", logger?: Logger) {
    super(deleteMode);

    this.collection = collection;
    this.firestoreEntityFactory = new FirestoreEntityFactory(
      collection.path,
      logger?.child({ collectionName: this.collection.path, }),
    );
    this.logger = logger;
  }

  async findByID(
    id: Entity["id"]["value"],
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<Entity | null> {
    const docRef = this.collection.doc(typeof id === "string" ? id : id!.toString());
    let docSnap;

    this.logger?.debug("[FirestoreDAO findByID] started", {
      collectionName: this.collection.path,
      path: docRef.path,
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      docSnap = await uow.get(docRef);
    } else {
      docSnap = await docRef.get();
    }

    this.logger?.debug("[FirestoreDAO findByID] retrieved document snapshot", {
      exists: docSnap.exists,
    });

    if (this.deleteMode === "SOFT" && docSnap.exists) {
      const isDeleted = docSnap.data()!["is_deleted"];

      if (isDeleted && !includeDeleted) {
        this.logger?.debug("[FirestoreDAO findByID] entity is soft deleted and not including deleted");

        return null;
      }
    }

    const entity = this.firestoreEntityFactory.fromSnapshot(docSnap);

    this.logger?.debug("[FirestoreDAO findByID] completed", {
      entityId: entityId(entity)
    });

    return entity;
  }

  async findOneBy(
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<Entity | null> {
    if (this.deleteMode === "SOFT" && !includeDeleted) {
      criteria = criteria.where("is_deleted", "EQUAL", false);
    }

    criteria = criteria.limitResults(1);

    this.logger?.debug("[FirestoreDAO findOneBy] started", {
      criteria,
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });

    const querySnap = await FirestoreCriteriaQueryExecutor.execute(
      this.collection,
      criteria,
      uow,
      this.logger?.child({
        method: 'findOneBy',
        collectionName: this.collection.path,
      }),
    );

    this.logger?.debug("[FirestoreDAO findOneBy] retrieved query snapshot", {
      size: querySnap.size,
    });

    if (querySnap.empty) return null;

    const docSnap = querySnap.docs[0]!;
    const entity = this.firestoreEntityFactory.fromSnapshot(docSnap);

    this.logger?.debug("[FirestoreDAO findOneBy] completed", {
      entityId: entityId(entity)
    });

    return entity;
  }

  async getAll(
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<Entity[]> {
    let query: Query = this.collection;

    if (this.deleteMode === "SOFT" && !includeDeleted) {
      query = query.where("is_deleted", "==", false);
    }

    let querySnap;

    this.logger?.debug("[FirestoreDAO getAll] started", {
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      querySnap = await uow.getQuery(query);
    } else {
      querySnap = await query.get();
    }

    this.logger?.debug("[FirestoreDAO getAll] retrieved query snapshot", {
      size: querySnap.size,
    });

    if (querySnap.empty) return [];

    const entities = this.firestoreEntityFactory.fromSnapshots(querySnap.docs);

    this.logger?.debug("[FirestoreDAO getAll] completed", {
      entityIds: entityIds(entities),
    });

    return entities;
  }

  async search(
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<Entity[]> {
    if (this.deleteMode === "SOFT" && !includeDeleted) {
      criteria = criteria.where("is_deleted", "EQUAL", false);
    }
    
    this.logger?.debug("[FirestoreDAO search] started", {
      criteria,
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });
    
    const querySnap = await FirestoreCriteriaQueryExecutor.execute(
      this.collection,
      criteria,
      uow,
      this.logger?.child({
        method: 'search',
        collectionName: this.collection.path,
      }),
    );

    this.logger?.debug("[FirestoreDAO search] retrieved query snapshot", {
      size: querySnap.size,
    });

    if (querySnap.empty) return [];

    const entities = this.firestoreEntityFactory.fromSnapshots(querySnap.docs);

    this.logger?.debug("[FirestoreDAO search] completed", {
      entityIds: entityIds(entities),
    });

    return entities;
  }

  async count(
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<number> {
    this.logger?.debug("[FirestoreDAO count] started", {
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });

    const count = await this.countBy(new Criteria(), uow, includeDeleted);

    this.logger?.debug("[FirestoreDAO count] completed", {
      count,
    });

    return count;
  }

  async countBy(
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<number> {
    if (this.deleteMode === "SOFT" && !includeDeleted) {
      criteria = criteria.where("is_deleted", "EQUAL", false);
    }

    this.logger?.debug("[FirestoreDAO countBy] started", {
      criteria,
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });

    const count = await FirestoreCriteriaQueryExecutor.count(
      this.collection,
      criteria,
      uow,
      this.logger?.child({
        method: 'countBy',
        collectionName: this.collection.path,
      }),
    );

    this.logger?.debug("[FirestoreDAO countBy] completed", {
      count,
    });

    return count;
  }

  async create(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString(),
    );

    this.logger?.debug("[FirestoreDAO create] started", {
      entityId: entityId(entity),
      uow: unitOfWorkKind(uow),
      path: docRef.path,
    });

    const data = EntityFirestoreFactory.fromEntity(entity);

    this.logger?.debug("[FirestoreDAO create] created document data", {
      data,
    });

    if (this.deleteMode === "SOFT") {
      data.is_deleted = false;
      data.deleted_at = null;
    }

    if (uow) {
      uow.create(docRef, data);
    } else {
      await docRef.create(data);
    }

    this.logger?.debug("[FirestoreDAO create] completed");

    return entity;
  }

  async update(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );

    this.logger?.debug("[FirestoreDAO update] started", {
      entityId: entityId(entity),
      uow: unitOfWorkKind(uow),
      path: docRef.path,
    });

    const data = EntityFirestoreFactory.fromEntity(entity);

    this.logger?.debug("[FirestoreDAO update] created document data", {
      data,
    });

    if (this.deleteMode === "SOFT") {
      data.is_deleted = false;
      data.deleted_at = null;
    }

    if (uow) {
      uow.update(docRef, data);
    } else {
      await docRef.update(data);
    }

    this.logger?.debug("[FirestoreDAO update] completed");

    return entity;
  }

  async delete(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );

    this.logger?.debug("[FirestoreDAO delete] started", {
      entityId: entityId(entity),
      uow: unitOfWorkKind(uow),
      path: docRef.path,
    });

    if (uow) {
      if (this.deleteMode === "HARD") {
        uow.delete(docRef);
      } else {
        const data = EntityFirestoreFactory.fromEntity(entity);
        data.is_deleted = true;
        data.deleted_at = Timestamp.now();
        
        uow.update(docRef, data);
      }
    } else {
      if (this.deleteMode === "HARD") {
        await docRef.delete();
      } else {
        const data = EntityFirestoreFactory.fromEntity(entity);
        data.is_deleted = true;
        data.deleted_at = Timestamp.now();

        await docRef.update(data);
      }
    }

    this.logger?.debug("[FirestoreDAO delete] completed", { entity });

    return entity;
  }

  async exists(
    criteria: Criteria,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
    includeDeleted = false,
  ): Promise<boolean> {
    this.logger?.debug("[FirestoreDAO exists] started", {
      criteria,
      uow: unitOfWorkKind(uow),
      includeDeleted,
    });

    const entity = await this.findOneBy(criteria, uow, includeDeleted);

    this.logger?.debug("[FirestoreDAO exists] completed", {
      entityId: entityId(entity),
    });

    return entity !== null;
  }

  async deleteByID(
    id: Entity["id"]["value"],
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
  ): Promise<void> {
    this.logger?.debug("[FirestoreDAO deleteByID] started", {
      id,
      uow: unitOfWorkKind(uow),
    });

    const entity = await this.findByID(id, uow);

    this.logger?.debug("[FirestoreDAO deleteByID] completed", {
      entityId: entityId(entity),
    });

    if (entity) {
      await this.delete(entity, uow);
    }
  }

  async save(
    entity: Entity,
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
  ): Promise<Entity> {
    this.logger?.debug("[FirestoreDAO save] started", {
      entityId: entityId(entity),
      uow: unitOfWorkKind(uow),
    });

    const existing = await this.findByID(entity.id.value, uow, true);

    this.logger?.debug("[FirestoreDAO save] completed", {
      exists: existing !== null,
    });

    if (existing) {
      return this.update(entity, uow);
    } else {
      return this.create(entity, uow);
    }
  }

  async saveMany(
    entities: Entity[],
    uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork,
  ): Promise<Entity[]> {
    this.logger?.debug("[FirestoreDAO saveMany] started", {
      entityIds: entityIds(entities),
      uow: unitOfWorkKind(uow),
    });

    const promises = entities.map((entity) => this.save(entity, uow));

    this.logger?.debug("[FirestoreDAO exists] completed");

    return Promise.all(promises);
  }

  async restore(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    this.logger?.debug("[FirestoreDAO restore] started", {
      entityId: entityId(entity),
      uow: unitOfWorkKind(uow),
      deleteMode: this.deleteMode,
    });

    if (this.deleteMode === "HARD") {
      throw new EntityNotRecoverable();
    }

    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );

    this.logger?.debug("[FirestoreDAO restore] found document", {
      path: docRef.path,
    });

    const data = EntityFirestoreFactory.fromEntity(entity);

    this.logger?.debug("[FirestoreDAO restore] created document data", {
      data,
    });

    data.is_deleted = false;
    data.deleted_at = null;

    if (uow) {
      uow.update(docRef, data);
    } else {
      await docRef.update(data);
    }

    if ('is_deleted' in entity) {
      entity.is_deleted = false;
    }

    if ('isDeleted' in entity) {
      entity.isDeleted = false;
    }

    if ('deleted_at' in entity) {
      entity.deleted_at = null;
    }

    if ('deletedAt' in entity) {
      entity.deletedAt = null;
    }

    this.logger?.debug("[FirestoreDAO restore] completed", { entity });

    return entity;
  }
}
