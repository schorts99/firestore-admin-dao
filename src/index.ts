export { FirestoreDAO } from "./firestore-dao.js";
export { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work.js";
export { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work.js";
export { FirestoreTypesToPrimitivesFormatter } from "./firestore-types-to-primitives-formatter.js";
export { CriteriaToFirestoreSymbolsTranslator } from "./criteria-to-firestore-symbols-translator.js";
export { FirestoreEntityFactory } from "./firestore-entity-factory.js";
export { PrimitiveTypesToFirestoreFormatter } from "./primitive-types-to-firestore-formatter.js";
export { EntityFirestoreFactory } from "./entity-firestore-factory.js";
export { FirestoreUnitOfWorkRunner } from "./firestore-unit-of-work-runner.js";
export { DataMigrator } from "./data-migrator.js";
export * from "./exceptions/index.js";

export { getFirestore, Firestore, type CollectionReference, Timestamp } from "firebase-admin/firestore";
export { initializeApp, getApps, cert } from "firebase-admin/app";
export { EntityRegistry, RegisterEntity } from "@schorts/shared-kernel";
export { getAuth } from "firebase-admin/auth"
export type { App } from "firebase-admin/app";
export type { Auth } from "firebase-admin/auth";
