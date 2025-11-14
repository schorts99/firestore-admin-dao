export { FirestoreDAO } from "./firestore-dao";
export { FirestoreBatchUnitOfWork } from "./firestore-batch-unit-of-work";
export { FirestoreTransactionUnitOfWork } from "./firestore-transaction-unit-of-work";
export { FirestoreTypesToPrimitivesFormatter } from "./firestore-types-to-primitives-formatter";
export { CriteriaToFirestoreSymbolsTranslator } from "./criteria-to-firestore-symbols-translator";
export { FirestoreEntityFactory } from "./firestore-entity-factory";
export { PrimitiveTypesToFirestoreFormatter } from "./primitive-types-to-firestore-formatter";
export { EntityFirestoreFactory } from "./entity-firestore-factory";
export { FirestoreUnitOfWorkRunner } from "./firestore-unit-of-work-runner";
export { DataMigrator } from "./data-migrator";
export * from "./exceptions";
export { getFirestore, Firestore, type CollectionReference } from "firebase-admin/firestore";
export { initializeApp, getApps, cert } from "firebase-admin/app";
export { EntityRegistry, RegisterEntity } from "@schorts/shared-kernel";
export { getAuth, FirebaseAuthError } from "firebase-admin/auth";
export type { App } from "firebase-admin/app";
export type { Auth } from "firebase-admin/auth";
//# sourceMappingURL=index.d.ts.map