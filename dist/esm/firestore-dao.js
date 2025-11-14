"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreDAO = void 0;
const shared_kernel_1 = require("@schorts/shared-kernel");
const firestore_criteria_query_executor_1 = require("./firestore-criteria-query-executor");
const firestore_entity_factory_1 = require("./firestore-entity-factory");
const firestore_transaction_unit_of_work_1 = require("./firestore-transaction-unit-of-work");
const entity_firestore_factory_1 = require("./entity-firestore-factory");
class FirestoreDAO extends shared_kernel_1.DAO {
    collection;
    firestoreEntityFactory;
    logger;
    constructor(collection, deleteMode, logger) {
        super(deleteMode);
        this.collection = collection;
        this.firestoreEntityFactory = new firestore_entity_factory_1.FirestoreEntityFactory(collection.path, logger?.child({ collectionName: this.collection.path, }));
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
        if (this.deleteMode === "SOFT" && docSnap.exists) {
            const isDeleted = docSnap.data()["is_deleted"];
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
    async findOneBy(criteria, uow) {
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
        const querySnap = await firestore_criteria_query_executor_1.FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow, this.logger?.child({
            status: 'IN_PROGRESS',
            class: 'FirestoreDAO',
            method: 'findOneBy',
            collectionName: this.collection.path,
        }));
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
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreDAO",
            method: "findOneBy",
            collectionName: this.collection.path,
        }, { entity });
        return entity;
    }
    async getAll(uow) {
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
        if (uow && uow instanceof firestore_transaction_unit_of_work_1.FirestoreTransactionUnitOfWork) {
            querySnap = await uow.getQuery(query);
        }
        else {
            querySnap = await query.get();
        }
        this.logger?.debug({
            status: "IN_PROGRESS",
            class: "FirestoreDAO",
            method: "getAll",
            collectionName: this.collection.path,
        }, { querySnap });
        if (querySnap.empty)
            return [];
        const entities = this.firestoreEntityFactory.fromSnapshots(querySnap.docs);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreDAO",
            method: "getAll",
            collectionName: this.collection.path,
        }, { entities });
        return entities;
    }
    async search(criteria, uow) {
        if (this.deleteMode === "SOFT") {
            criteria.where("is_deleted", "IN", [null, false]);
        }
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "search",
            collectionName: this.collection.path,
        }, { criteria, uow });
        const querySnap = await firestore_criteria_query_executor_1.FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow, this.logger?.child({
            status: 'IN_PROGRESS',
            class: 'FirestoreDAO',
            method: 'search',
            collectionName: this.collection.path,
        }));
        this.logger?.debug({
            status: "IN_PROGRESS",
            class: "FirestoreDAO",
            method: "search",
            collectionName: this.collection.path,
        }, { querySnap });
        if (querySnap.empty)
            return [];
        const entities = this.firestoreEntityFactory.fromSnapshots(querySnap.docs);
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreDAO",
            method: "search",
            collectionName: this.collection.path,
        }, { entities });
        return entities;
    }
    async countBy(criteria, uow) {
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "countBy",
            collectionName: this.collection.path,
        }, { criteria, uow });
        if (this.deleteMode === "SOFT") {
            criteria.where("is_deleted", "IN", [null, false]);
        }
        const querySnap = await firestore_criteria_query_executor_1.FirestoreCriteriaQueryExecutor.execute(this.collection, criteria, uow, this.logger?.child({
            status: 'IN_PROGRESS',
            class: 'FirestoreDAO',
            method: 'countBy',
            collectionName: this.collection.path,
        }));
        this.logger?.debug({
            status: "COMPLETED",
            class: "FirestoreDAO",
            method: "countBy",
            collectionName: this.collection.path,
        }, { querySnap });
        return querySnap.size;
    }
    async create(entity, uow) {
        const docRef = this.collection.doc(typeof entity.id.value === "string" ? entity.id.value : entity.id.value.toString());
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "create",
            collectionName: this.collection.path,
        }, { entity, uow, docRef });
        const data = entity_firestore_factory_1.EntityFirestoreFactory.fromEntity(entity);
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
        }
        else {
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
    async update(entity, uow) {
        const docRef = this.collection.doc(typeof entity.id.value === "string" ? entity.id.value : entity.id.value.toString());
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "update",
            collectionName: this.collection.path,
        }, { entity, uow, docRef });
        const data = entity_firestore_factory_1.EntityFirestoreFactory.fromEntity(entity);
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
        }
        else {
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
    async delete(entity, uow) {
        const docRef = this.collection.doc(typeof entity.id.value === "string" ? entity.id.value : entity.id.value.toString());
        this.logger?.debug({
            status: "STARTED",
            class: "FirestoreDAO",
            method: "delete",
            collectionName: this.collection.path,
        }, { entity, uow, docRef });
        if (uow) {
            if (this.deleteMode === "HARD") {
                uow.delete(docRef);
            }
            else {
                const data = entity_firestore_factory_1.EntityFirestoreFactory.fromEntity(entity);
                data.is_deleted = true;
                uow.update(docRef, data);
            }
        }
        else {
            if (this.deleteMode === "HARD") {
                await docRef.delete();
            }
            else {
                const data = entity_firestore_factory_1.EntityFirestoreFactory.fromEntity(entity);
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
exports.FirestoreDAO = FirestoreDAO;
//# sourceMappingURL=firestore-dao.js.map