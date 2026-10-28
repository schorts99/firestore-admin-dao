import type { WriteBatch } from "firebase-admin/firestore";
import { WriteBatch as MockedWriteBatch } from "firebase-admin/firestore";
import { Logger } from "@schorts/shared-kernel";

export type QueryCall = [method: string, ...args: unknown[]];

export type StoredDocs = Record<string, Record<string, unknown>>;

export class FakeDocumentSnapshot {
  constructor(
    readonly id: string,
    private readonly stored: Record<string, unknown> | undefined,
    readonly ref: FakeDocumentReference,
  ) {}

  get exists(): boolean {
    return this.stored !== undefined;
  }

  data(): Record<string, unknown> | undefined {
    return this.stored ? { ...this.stored } : undefined;
  }
}

export class FakeDocumentReference {
  readonly get = jest.fn(async () => new FakeDocumentSnapshot(this.id, this.docs[this.id], this));
  readonly create = jest.fn(async (_data: Record<string, unknown>) => undefined);
  readonly update = jest.fn(async (_data: Record<string, unknown>) => undefined);
  readonly delete = jest.fn(async () => undefined);

  constructor(readonly id: string, private readonly docs: StoredDocs) {}
}

export function querySnapshotOf(docs: FakeDocumentSnapshot[]) {
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: FakeDocumentSnapshot) => void) => docs.forEach(callback),
  };
}

/**
 * Immutable, chainable stand-in for a Firestore query. Every `get()` records the chain of
 * calls that built it in `issued`, and answers with every stored document: the tests assert
 * on the calls, not on Firestore's filtering.
 */
export class FakeQuery {
  constructor(
    protected readonly docs: StoredDocs,
    readonly issued: QueryCall[][],
    readonly calls: QueryCall[] = [],
  ) {}

  where(...args: unknown[]) {
    return this.chain("where", args);
  }

  orderBy(...args: unknown[]) {
    return this.chain("orderBy", args);
  }

  startAt(...args: unknown[]) {
    return this.chain("startAt", args);
  }

  endAt(...args: unknown[]) {
    return this.chain("endAt", args);
  }

  limit(...args: unknown[]) {
    return this.chain("limit", args);
  }

  offset(...args: unknown[]) {
    return this.chain("offset", args);
  }

  async get() {
    this.issued.push(this.calls);

    return querySnapshotOf(
      Object.keys(this.docs).map((id) => new FakeDocumentSnapshot(id, this.docs[id], new FakeDocumentReference(id, this.docs))),
    );
  }

  private chain(method: string, args: unknown[]): FakeQuery {
    return new FakeQuery(this.docs, this.issued, [...this.calls, [method, ...args]]);
  }
}

export class FakeCollection extends FakeQuery {
  readonly refs = new Map<string, FakeDocumentReference>();
  readonly firestore = { batch: jest.fn() };

  constructor(readonly path: string, docs: StoredDocs = {}) {
    super(docs, []);
  }

  doc(id: string): FakeDocumentReference {
    if (!this.refs.has(id)) {
      this.refs.set(id, new FakeDocumentReference(id, this.docs));
    }

    return this.refs.get(id)!;
  }
}

export function fakeTransaction() {
  return {
    get: jest.fn(async (refOrQuery: { get(): Promise<unknown> }) => refOrQuery.get()),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

/** A batch from the `firebase-admin/firestore` mock, whose methods are jest mocks. */
export function mockedWriteBatch(): WriteBatch {
  return new (MockedWriteBatch as unknown as new () => WriteBatch)();
}

/** Casts a fake to the Firestore type a constructor or method expects. */
export function asFirestore<T>(fake: unknown): T {
  return fake as T;
}

/** Records messages without cloning their context, which holds Firestore objects. */
export class RecordingLogger extends Logger {
  readonly messages: string[] = [];

  log(message: string): void {
    this.messages.push(message);
  }

  info(message: string): void {
    this.messages.push(message);
  }

  debug(message: string): void {
    this.messages.push(message);
  }

  warn(message: string): void {
    this.messages.push(message);
  }

  error(message: string): void {
    this.messages.push(message);
  }
}
