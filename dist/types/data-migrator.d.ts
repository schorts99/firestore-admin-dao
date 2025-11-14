import { CollectionReference } from "firebase-admin/firestore";
export declare class DataMigrator {
    private readonly collection;
    constructor(collection: CollectionReference);
    migrateFromHardToSoftDelete(): Promise<void>;
}
//# sourceMappingURL=data-migrator.d.ts.map