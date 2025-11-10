"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreDAO = void 0;
const firestore_criteria_query_executor_1 = require("./firestore-criteria-query-executor");
const firestore_entity_factory_1 = require("./firestore-entity-factory");
const firestore_transaction_unit_of_work_1 = require("./firestore-transaction-unit-of-work");
const entity_firestore_factory_1 = require("./entity-firestore-factory");
const exceptions_1 = require("./exceptions");
class FirestoreDAO {
    collection;
    firestoreEntityFactory;
    logger;
    constructor(collection, logger) {
        this.collection = collection;
        this.firestoreEntityFactory = new firestore_entity_factory_1.FirestoreEntityFactory(collection.path);
        this.logger = logger;
    }
    async findByID(id, uow) {
        const docRef = this.collection.doc(typeof id === "string" ? id : id.toString());
        let docSnap;
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "findByID",
            collectionName: this.collection.path,
        }, { docRef, uow });
        if (uow && uow instanceof firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork) {
            docSnap = await uow.get(docRef);
        }
        else {
            docSnap = await docRef.get();
        }
        this.logger?.debug({
            status: "IN_PROGRESS",
            class: "FirestoreDAO",
            method: "findByID",
            collectionName: this.collection.path,
        }, { docSnap });
        const entity = this.firestoreEntityFactory.fromSnapshot(docSnap);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreDAO",
            method: "findByID",
            collectionName: this.collection.path,
        }, { entity });
        return entity;
    }
    async findOneBy(criteria, uow) {
        criteria.limitResults(1);
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "findOneBy",
            collectionName: this.collection.path,
        }, { criteria, uow });
        const querySnap = await firestore_criteria_query_executor_1.FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow);
        this.logger?.debug({
            status: "IN_PROGRESS",
            class: "FirestoreDAO",
            method: "findOneBy",
            collectionName: this.collection.path,
        }, { querySnap });
        if (querySnap.empty)
            return null;
        const docSnap = querySnap.docs[0];
        const entity = this.firestoreEntityFactory.fromSnapshot(docSnap);
        ;
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreDAO",
            method: "findOneBy",
            collectionName: this.collection.path,
        }, { entity });
        return entity;
    }
    async getAll(uow) {
        const query = this.collection.limit(1000);
        let querySnap;
        if (uow && uow instanceof firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork) {
            querySnap = await uow.getQuery(query);
        }
        else {
            querySnap = await this.collection.get();
        }
        if (querySnap.empty)
            return [];
        return this.firestoreEntityFactory.fromSnapshots(querySnap.docs);
    }
    async search(criteria, uow) {
        const querySnap = await firestore_criteria_query_executor_1.FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow);
        if (querySnap.empty)
            return [];
        return this.firestoreEntityFactory.fromSnapshots(querySnap.docs);
    }
    async countBy(criteria, uow) {
        const querySnap = await firestore_criteria_query_executor_1.FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow);
        return querySnap.size;
    }
    async create(entity, uow) {
        const docRef = this.collection.doc(typeof entity.id.value === "string" ? entity.id.value : entity.id.value.toString());
        let docSnap;
        if (uow && uow instanceof firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork) {
            docSnap = await uow.get(docRef);
        }
        else {
            docSnap = await docRef.get();
        }
        if (docSnap.exists) {
            throw new exceptions_1.DocAlreadyExists();
        }
        const data = entity_firestore_factory_1.EntityFirestoreFactory.fromEntity(entity);
        if (uow) {
            uow.set(docRef, data);
        }
        else {
            await docRef.set(data);
        }
        return entity;
    }
    async update(entity, uow) {
        const docRef = this.collection.doc(typeof entity.id.value === "string" ? entity.id.value : entity.id.value.toString());
        const data = entity_firestore_factory_1.EntityFirestoreFactory.fromEntity(entity);
        if (uow) {
            uow.update(docRef, data);
        }
        else {
            await docRef.update(data);
        }
        return entity;
    }
    async delete(entity, uow) {
        const docRef = this.collection.doc(typeof entity.id.value === "string" ? entity.id.value : entity.id.value.toString());
        if (uow) {
            uow.delete(docRef);
        }
        else {
            await docRef.delete();
        }
        return entity;
    }
}
exports.FirestoreDAO = FirestoreDAO;
//# sourceMappingURL=firestore-dao.js.map