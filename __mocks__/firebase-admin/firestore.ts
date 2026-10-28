export class WriteBatch {
  create = jest.fn(() => this);
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
  constructor(private readonly date: Date = new Date()) {}

  static now() {
    return new Timestamp();
  }

  toDate() {
    return this.date;
  }

  static fromDate(date: Date) {
    return new Timestamp(date);
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
