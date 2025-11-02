import { CollectionReference } from "firebase-admin/firestore";
import {
  DAO,
  Model,
  ValueObject,
  Entity as BaseEntity,
  Criteria,
} from "@schorts/shared-kernel";

import { FirestoreCriteriaQueryExecutor } from "./firestore-criteria-query-executor";
import { FirestoreEntityFactory } from "./firestore-entity-factory";
import { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work";
import { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";
import { EntityFirestoreFactory } from "./entity-firestore-factory";
import { DocAlreadyExists } from "./exceptions";

export abstract class FirestoreDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>
> implements DAO<M, Entity> {
  private readonly collection: CollectionReference;
  private readonly firestoreEntityFactory: FirestoreEntityFactory<Entity>;

  constructor(collection: CollectionReference) {
    this.collection = collection;
    this.firestoreEntityFactory = new FirestoreEntityFactory(collection.path);
  }

  async findByID(id: Entity["id"]["value"], uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity | null> {
    const docRef = this.collection.doc(typeof id === "string" ? id : id!.toString());
    let docSnap;

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      docSnap = await uow.get(docRef);
    } else {
      docSnap = await docRef.get();
    }

    return this.firestoreEntityFactory.fromSnapshot(docSnap);
  }

  async findOneBy(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity | null> {
    criteria.limitResults(1);

    const querySnap = await FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow);

    if (querySnap.empty) return null;

    const docSnap = querySnap.docs[0]!;
    return this.firestoreEntityFactory.fromSnapshot(docSnap);
  }

  async getAll(uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity[]> {
    const query = this.collection.limit(1000);
    let querySnap;

    if (uow && uow instanceof FirestoreTransactionUnitOfWork) {
      querySnap = await uow.getQuery(query);
    } else {
      querySnap = await this.collection.get();
    }

    if (querySnap.empty) return [];

    return this.firestoreEntityFactory.fromSnapshots(querySnap.docs);
  }

  async search(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity[]> {
    const querySnap = await FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow);

    if (querySnap.empty) return [];

    return this.firestoreEntityFactory.fromSnapshots(querySnap.docs);
  }

  async countBy(criteria: Criteria, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<number> {
    const querySnap = await FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow);

    return querySnap.size;
  }

  async create(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString(),
    );
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      throw new DocAlreadyExists();
    }

    const data = EntityFirestoreFactory.fromEntity(entity);

    if (uow) {
      uow.set(docRef, data);
    } else {
      await docRef.set(data);
    }

    return entity;
  }

  async update(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );
    const data = EntityFirestoreFactory.fromEntity(entity);

    if (uow) {
      uow.update(docRef, data);
    } else {
      await docRef.update(data);
    }

    return entity;
  }

  async delete(entity: Entity, uow?: FirestoreBatchUnitOfWork | FirestoreTransactionUnitOfWork): Promise<Entity> {
    const docRef = this.collection.doc(
      typeof entity.id.value === "string" ? entity.id.value : entity.id.value!.toString()
    );

    if (uow) {
      uow.delete(docRef);
    } else {
      await docRef.delete();
    }

    return entity;
  }
}

