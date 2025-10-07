import { Timestamp } from "firebase-admin/firestore";

import { FirestoreTypesToPrimitivesFormatter } from "../src";

describe('FirestoreTypesToPrimitivesFormatter', () => {
  describe('.formatTimestamps', () => {
    const data = {
      created_at: Timestamp.now(),
      name: "Jorge",
      updated_at: Timestamp.now(),
    };

    it('should format the timestamps to date strings', () => {
      const formmatedData = FirestoreTypesToPrimitivesFormatter.formatTimestamps(data);

      expect(typeof formmatedData.created_at).toEqual("string");
      expect(typeof formmatedData.updated_at).toEqual("string");
    });

    it('should leave evertyhing else untouched', () => {
      const formmatedData = FirestoreTypesToPrimitivesFormatter.formatTimestamps(data);

      expect(formmatedData.name).toEqual(data.name);
    });
  });
});
