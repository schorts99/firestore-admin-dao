import { CollectionReference } from "firebase-admin/firestore";
import { Logger } from "@schorts/shared-kernel";
export declare class DataMigrator {
    private readonly collection;
    private readonly logger?;
    constructor(collection: CollectionReference, logger?: Logger | undefined);
    migrateFromHardToSoftDelete(): Promise<void>;
}
//# sourceMappingURL=data-migrator.d.ts.map