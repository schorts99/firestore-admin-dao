export class WriteBatch {
  set = jest.fn(() => this);
  update = jest.fn(() => this);
  delete = jest.fn(() => this);
  commit = jest.fn(() => Promise.resolve());
}

export function collection() {}

export function doc() {}

export async function getDoc() {
  return {
    exists: jest.fn(() => true),
    data: () => ({}),
  };
}

export class FieldPath {
  static documentId() {
    return "__mocked_document_id__";
  }
}

export function writeBatch(firestore: any) {
  return new WriteBatch();
}

export class Timestamp {
  static now() {
    return new Timestamp();
  }

  toDate() {
    return new Date();
  }

  static fromDate(date: Date) {
    return { __timestamp: true, date };
  }
}

export class Firestore {
  batch() {
    return new WriteBatch();
  }

  collection = jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
    })),
  }));
}
