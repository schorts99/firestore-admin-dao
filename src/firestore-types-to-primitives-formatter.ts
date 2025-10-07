import { DocumentData, Timestamp } from "firebase-admin/firestore";

export class FirestoreTypesToPrimitivesFormatter {
  static format(data: DocumentData): DocumentData {
    return this.formatTimestamps(data);
  }

  static formatTimestamps(data: DocumentData): DocumentData {
    const formattedDates: DocumentData = { ...data };

    Object.keys(formattedDates).forEach((key) => {
      if (formattedDates[key] instanceof Timestamp) {
        formattedDates[key] = formattedDates[key].toDate().toString();
      }
    });

    return formattedDates;
  }
}

