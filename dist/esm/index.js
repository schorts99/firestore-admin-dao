"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseAuthError = exports.getAuth = exports.RegisterEntity = exports.EntityRegistry = exports.cert = exports.getApps = exports.initializeApp = exports.Firestore = exports.getFirestore = exports.EntityFirestoreFactory = exports.PrimitiveTypesToFirestoreFormatter = exports.FirestoreEntityFactory = exports.CriteriaToFirestoreSymbolsTranslator = exports.FirestoreTypesToPrimitivesFormatter = exports.FirestoreBatchUnitOfWork = exports.FirestoreDAO = void 0;
var firestore_dao_1 = require("./firestore-dao");
Object.defineProperty(exports, "FirestoreDAO", { enumerable: true, get: function () { return firestore_dao_1.FirestoreDAO; } });
var firestore_batch_unit_of_work_1 = require("./firestore-batch-unit-of-work");
Object.defineProperty(exports, "FirestoreBatchUnitOfWork", { enumerable: true, get: function () { return firestore_batch_unit_of_work_1.FirestoreBatchUnitOfWork; } });
var firestore_types_to_primitives_formatter_1 = require("./firestore-types-to-primitives-formatter");
Object.defineProperty(exports, "FirestoreTypesToPrimitivesFormatter", { enumerable: true, get: function () { return firestore_types_to_primitives_formatter_1.FirestoreTypesToPrimitivesFormatter; } });
var criteria_to_firestore_symbols_translator_1 = require("./criteria-to-firestore-symbols-translator");
Object.defineProperty(exports, "CriteriaToFirestoreSymbolsTranslator", { enumerable: true, get: function () { return criteria_to_firestore_symbols_translator_1.CriteriaToFirestoreSymbolsTranslator; } });
var firestore_entity_factory_1 = require("./firestore-entity-factory");
Object.defineProperty(exports, "FirestoreEntityFactory", { enumerable: true, get: function () { return firestore_entity_factory_1.FirestoreEntityFactory; } });
var primitive_types_to_firestore_formatter_1 = require("./primitive-types-to-firestore-formatter");
Object.defineProperty(exports, "PrimitiveTypesToFirestoreFormatter", { enumerable: true, get: function () { return primitive_types_to_firestore_formatter_1.PrimitiveTypesToFirestoreFormatter; } });
var entity_firestore_factory_1 = require("./entity-firestore-factory");
Object.defineProperty(exports, "EntityFirestoreFactory", { enumerable: true, get: function () { return entity_firestore_factory_1.EntityFirestoreFactory; } });
__exportStar(require("./exceptions"), exports);
var firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "getFirestore", { enumerable: true, get: function () { return firestore_1.getFirestore; } });
Object.defineProperty(exports, "Firestore", { enumerable: true, get: function () { return firestore_1.Firestore; } });
var app_1 = require("firebase-admin/app");
Object.defineProperty(exports, "initializeApp", { enumerable: true, get: function () { return app_1.initializeApp; } });
Object.defineProperty(exports, "getApps", { enumerable: true, get: function () { return app_1.getApps; } });
Object.defineProperty(exports, "cert", { enumerable: true, get: function () { return app_1.cert; } });
var shared_kernel_1 = require("@schorts/shared-kernel");
Object.defineProperty(exports, "EntityRegistry", { enumerable: true, get: function () { return shared_kernel_1.EntityRegistry; } });
Object.defineProperty(exports, "RegisterEntity", { enumerable: true, get: function () { return shared_kernel_1.RegisterEntity; } });
var auth_1 = require("firebase-admin/auth");
Object.defineProperty(exports, "getAuth", { enumerable: true, get: function () { return auth_1.getAuth; } });
Object.defineProperty(exports, "FirebaseAuthError", { enumerable: true, get: function () { return auth_1.FirebaseAuthError; } });
//# sourceMappingURL=index.js.map