import { CollectionReference } from "firebase-admin/firestore";
import {
  DAO,
  Model,
  ValueObject,
  Entity as BaseEntity,
  Criteria,
  Logger,
  DeleteMode,
} from "@schorts/shared-kernel";

import { FirestoreCriteriaQueryExecutor } from "./firestore-criteria-query-executor";
import { FirestoreEntityFactory } from "./firestore-entity-factory";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";
import { EntityFirestoreFactory } from "./entity-firestore-factory";

export abstract class FirestoreDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>
> extends DAO<M, Entity> {
  private readonly collection: CollectionReference;
  private readonly firestoreEntityFactory: FirestoreEntityFactory<Entity>;
  private readonly logger: Logger | undefined;

  constructor(collection: CollectionReference, deleteMode: DeleteMode, logger?: Logger) {
    super(deleteMode);

    this.collection = collection;
    this.firestoreEntityFactory = new FirestoreEntityFactory(
      collection.path,
      logger?.child({ collectionName: this.collection.path, }),
    );
    this.logger = logger;
  }

  async findByID(id: Entity["id"]["value"], uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity | null> {
    const docRef = this.collection.doc(typeof id === "string" ? id : id!.toString());
    let docSnap;

    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "findByID",
      collectionName: this.collection.path,
    }, { docRef, uow });

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      docSnap = await uow.get(docRef);
    } else {
      docSnap = await docRef.get();
    }

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreDAO",
      method: "findByID",
      collectionName: this.collection.path,
    }, { docSnap });

    if (this.deleteMode === "SOFT" && docSnap.exists) {
      const isDeleted = docSnap.data()!["is_deleted"];

      if (isDeleted) {
        this.logger?.debug({
          status: "COMPLETED",
          class: "FirestoreDAO",
          method: "findByID",
          collectionName: this.collection.path,
        }, { isDeleted });

        return null;
      }
    }

    const entity = this.firestoreEntityFactory.fromSnapshot(docSnap);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "findByID",
      collectionName: this.collection.path,
    }, { entity });

    return entity;
  }

  async findOneBy(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity | null> {
    if (this.deleteMode === "SOFT") {
      criteria.where("is_deleted", "IN", [null, false]);
    }

    criteria.limitResults(1);

    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "findOneBy",
      collectionName: this.collection.path,
    }, { criteria, uow });

    const querySnap = await FirestoreCriteriaQueryExecutor.execute(
      this.collection,
      criteria,
      uow,
      this.logger?.child({
        status: 'IN_PROGRESS',
        class: 'FirestoreDAO',
        method: 'findOneBy',
        collectionName: this.collection.path,
      }),
    );

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreDAO",
      method: "findOneBy",
      collectionName: this.collection.path,
    }, { querySnap });

    if (querySnap.empty) return null;

    const docSnap = querySnap.docs[0]!;
    const entity = this.firestoreEntityFactory.fromSnapshot(docSnap);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "findOneBy",
      collectionName: this.collection.path,
    }, { entity });

    return entity;
  }

  async getAll(uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity[]> {
    let query = this.collection.limit(1000);

    if (this.deleteMode === 'SOFT') {
      query = query.where('is_deleted', 'in', [null, false]);
    }

    let querySnap;

    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "getAll",
      collectionName: this.collection.path,
    }, { uow });

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      querySnap = await uow.getQuery(query);
    } else {
      querySnap = await query.get();
    }

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreDAO",
      method: "getAll",
      collectionName: this.collection.path,
    }, { querySnap });

    if (querySnap.empty) return [];

    const entities = this.firestoreEntityFactory.fromSnapshots(querySnap.docs);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "getAll",
      collectionName: this.collection.path,
    }, { entities });

    return entities;
  }

  async search(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity[]> {
    if (this.deleteMode === "SOFT") {
      criteria.where("is_deleted", "IN", [null, false]);
    }
    
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "search",
      collectionName: this.collection.path,
    }, { criteria, uow });
    
    const querySnap = await FirestoreCriteriaQueryExecutor.execute(
      this.collection,
      criteria,
      uow,
      this.logger?.child({
        status: 'IN_PROGRESS',
        class: 'FirestoreDAO',
        method: 'search',
        collectionName: this.collection.path,
      }),
    );

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreDAO",
      method: "search",
      collectionName: this.collection.path,
    }, { querySnap });

    if (querySnap.empty) return [];

    const entities = this.firestoreEntityFactory.fromSnapshots(querySnap.docs);

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "search",
      collectionName: this.collection.path,
    }, { entities });

    return entities;
  }

  async countBy(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<number> {
    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "countBy",
      collectionName: this.collection.path,
    }, { criteria, uow });

    if (this.deleteMode === "SOFT") {
      criteria.where("is_deleted", "IN", [null, false]);
    }
    
    const querySnap = await FirestoreCriteriaQueryExecutor.execute(
      this.collection,
      criteria,
      uow,
      this.logger?.child({
        status: 'IN_PROGRESS',
        class: 'FirestoreDAO',
        method: 'countBy',
        collectionName: this.collection.path,
      }),
    );

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "countBy",
      collectionName: this.collection.path,
    }, { querySnap });

    return querySnap.size;
  }

  async create(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString(),
    );

    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "create",
      collectionName: this.collection.path,
    }, { entity, uow, docRef });

    const data = EntityFirestoreFactory.fromEntity(entity);

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreDAO",
      method: "create",
      collectionName: this.collection.path,
    }, { data });

    if (this.deleteMode === "SOFT") {
      data.is_deleted = false;
    }

    if (uow) {
      uow.create(docRef, data);
    } else {
      await docRef.create(data);
    }

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "create",
      collectionName: this.collection.path,
    });

    return entity;
  }

  async update(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );

    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "update",
      collectionName: this.collection.path,
    }, { entity, uow, docRef });

    const data = EntityFirestoreFactory.fromEntity(entity);

    this.logger?.debug({
      status: "IN_PROGRESS",
      class: "FirestoreDAO",
      method: "update",
      collectionName: this.collection.path,
    }, { data });

    if (this.deleteMode === "SOFT") {
      data.is_deleted = false;
    }

    if (uow) {
      uow.update(docRef, data);
    } else {
      await docRef.update(data);
    }

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "update",
      collectionName: this.collection.path,
    });

    return entity;
  }

  async delete(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );

    this.logger?.debug({
      status: "STARTED",
      class: "FirestoreDAO",
      method: "delete",
      collectionName: this.collection.path,
    }, { entity, uow, docRef });

    if (uow) {
      if (this.deleteMode === "HARD") {
        uow.delete(docRef);
      } else {
        const data = EntityFirestoreFactory.fromEntity(entity);
        data.is_deleted = true;
        
        uow.update(docRef, data);
      }
    } else {
      if (this.deleteMode === "HARD") {
        await docRef.delete();
      } else {
        const data = EntityFirestoreFactory.fromEntity(entity);
        data.is_deleted = true;

        await docRef.update(data);
      }
    }

    this.logger?.debug({
      status: "COMPLETED",
      class: "FirestoreDAO",
      method: "delete",
      collectionName: this.collection.path,
    });

    return entity;
  }
}

