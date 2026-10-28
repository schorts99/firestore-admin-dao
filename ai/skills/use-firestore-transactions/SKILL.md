---
name: use-firestore-transactions
description: Write several Firestore documents atomically with @schorts/firestore-admin-dao — FirestoreUnitOfWorkRunner transactions (reads before writes, retried callbacks, publishing domain events after commit) and FirestoreBatchUnitOfWork for chunked bulk writes, plus how to combine them with the kernel command bus. Use when a change reads then writes several documents, or writes many documents at once.
---

# Use Firestore transactions and batches

Two tools, two jobs:

- **`FirestoreUnitOfWorkRunner`**: a Firestore transaction. Use it to read, decide, and write consistently.
- **`FirestoreBatchUnitOfWork`**: a write batch. Use it to apply many known writes together, without reads.

This skill transfers money between accounts with a transaction, then imports accounts with batches. Read [rules/units-of-work.md](../../rules/units-of-work.md) first.

## 1. The entity and its DAO

```ts
// file: banking/account.ts
import { FirestoreDAO, type CollectionReference } from "@schorts/firestore-admin-dao";
import { DomainEvent } from "@schorts/shared-kernel/domain-events";
import { Entity } from "@schorts/shared-kernel/entities";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class AccountId extends UUIDValue {
  readonly attributeName = "accountId";
}

export type AccountModel = { id: string; balance: number };
type Movement = { accountId: string; amount: number };

export class MoneyWithdrawn extends DomainEvent<Movement> {
  static readonly NAME = "banking.money_withdrawn";
  getEventName(): string {
    return MoneyWithdrawn.NAME;
  }
}

export class MoneyDeposited extends DomainEvent<Movement> {
  static readonly NAME = "banking.money_deposited";
  getEventName(): string {
    return MoneyDeposited.NAME;
  }
}

export class InsufficientFunds extends Error {
  override name = "InsufficientFunds";
}

export class Account extends Entity<AccountId, AccountModel> {
  constructor(id: AccountId, public balance = 0) {
    super(id);
  }

  withdraw(amount: number, correlationId: string): void {
    if (amount > this.balance) throw new InsufficientFunds(`Account ${this.id.value} cannot cover ${amount}`);
    this.balance -= amount;
    this.recordDomainEvent(new MoneyWithdrawn(correlationId, { accountId: this.id.value, amount }));
  }

  deposit(amount: number, correlationId: string): void {
    this.balance += amount;
    this.recordDomainEvent(new MoneyDeposited(correlationId, { accountId: this.id.value, amount }));
  }

  toPrimitives(): AccountModel {
    return { id: this.id.value, balance: this.balance };
  }

  protected override createId(rawId: unknown): AccountId {
    return new AccountId(String(rawId));
  }

  protected override restoreFromPrimitives(data: AccountModel): void {
    this.balance = data.balance;
  }
}

export const ACCOUNTS = "accounts";

export class AccountDAO extends FirestoreDAO<AccountModel, Account> {
  constructor(collection: CollectionReference) {
    super(collection);
  }
}
```

## 2. A transaction

- `runner.run(async uow => ...)` runs the callback in a Firestore transaction. Returning commits; throwing aborts and rethrows the error.
- Pass `uow` to every DAO call. Do **all reads first**, then the writes: Firestore rejects a read after a write.
- Firestore may run the callback again on contention, with fresh reads. Only DAO calls with `uow` belong inside.
- Return the domain events and publish them after `run` resolves. Publishing inside the callback could publish events for an attempt that is retried or aborted.

```ts
// file: banking/transfer.ts
import type { FirestoreUnitOfWorkRunner } from "@schorts/firestore-admin-dao";
import type { DomainEvent } from "@schorts/shared-kernel/domain-events";
import type { EventBus } from "@schorts/shared-kernel/event-bus";
import type { AccountDAO } from "./account.js";

export class AccountNotFound extends Error {
  override name = "AccountNotFound";
}

export async function transfer(
  runner: FirestoreUnitOfWorkRunner,
  accounts: AccountDAO,
  eventBus: EventBus,
  input: { from: string; to: string; amount: number },
  correlationId: string,
): Promise<void> {
  const events: DomainEvent[] = await runner.run(async uow => {
    const from = await accounts.findByID(input.from, uow);
    const to = await accounts.findByID(input.to, uow);
    if (!from || !to) throw new AccountNotFound("Both accounts must exist");

    from.withdraw(input.amount, correlationId);
    to.deposit(input.amount, correlationId);

    await accounts.update(from, uow);
    await accounts.update(to, uow);

    return [...from.pullDomainEvents(), ...to.pullDomainEvents()];
  });

  await eventBus.publishMany(events);
}
```

If the process stops between the commit and `publishMany`, the events are lost. When subscribers must see every event, write the events to an outbox collection inside the transaction and publish from it in a separate job.

## 3. Batches for bulk writes

- `begin()`, queue writes by passing the batch to `create`/`update`/`delete`, then `commit()`. Nothing is written before `commit()`.
- Reads do not go through the batch.
- Each commit must fit in a 10 MiB request, so chunk large inputs. Each chunk is atomic on its own; a failure leaves earlier chunks committed.
- Create a new `FirestoreBatchUnitOfWork` per chunk.

```ts
// file: banking/import-accounts.ts
import { FirestoreBatchUnitOfWork, type Firestore } from "@schorts/firestore-admin-dao";
import type { Account, AccountDAO } from "./account.js";

const CHUNK_SIZE = 400;

export async function importAccounts(firestore: Firestore, accounts: AccountDAO, input: Account[]): Promise<number> {
  let imported = 0;

  for (let start = 0; start < input.length; start += CHUNK_SIZE) {
    const chunk = input.slice(start, start + CHUNK_SIZE);
    const uow = new FirestoreBatchUnitOfWork(firestore);

    await uow.begin();
    for (const account of chunk) {
      // create fails the whole commit if any account already exists.
      await accounts.create(account, uow);
    }
    await uow.commit();

    imported += chunk.length;
  }

  return imported;
}
```

## 4. Inside a command handler

The kernel command bus's transactional mode cannot create a Firestore transaction. Leave it off for Firestore commands, run the transaction in the handler, and hand the events to the bus through `context.events`. The bus publishes them after the handler returns (with `autoPublishEvents` on).

```ts no-check
protected async execute(command: TransferMoney, context: CommandHandlerContext): Promise<void> {
  const events = await this.runner.run(async uow => {
    // reads, then writes, as in transfer() above
    return [...from.pullDomainEvents(), ...to.pullDomainEvents()];
  });
  context.events?.push(...events);
}
```

## 5. Test it

Transactions and batches need the emulator (see [test-firestore-daos](../test-firestore-daos/SKILL.md)). Cover the commit, and an abort that leaves both documents unchanged and publishes nothing:

```ts
// file: banking/transfer.test.ts
import { EntityRegistry, FirestoreUnitOfWorkRunner, getApps, getFirestore, initializeApp } from "@schorts/firestore-admin-dao";
import { InMemoryEventBus, InMemoryEventStore } from "@schorts/shared-kernel/event-bus";
import { Account, AccountDAO, AccountId, ACCOUNTS, InsufficientFunds, MoneyDeposited, MoneyWithdrawn } from "./account.js";
import { transfer } from "./transfer.js";

const host = process.env["FIRESTORE_EMULATOR_HOST"];
const projectId = "demo-test";
const describeWithEmulator = host ? describe : describe.skip;
const alice = "6f1c2b9e-1d2a-4f3b-8c4d-5e6f7a8b9c0d";
const bob = "7a2d3c0f-2e3b-4a4c-9d5e-6f7a8b9c0d1e";

describeWithEmulator("transfer", () => {
  const firestore = getFirestore(getApps()[0] ?? initializeApp({ projectId }));
  const accounts = new AccountDAO(firestore.collection(ACCOUNTS));
  const runner = new FirestoreUnitOfWorkRunner(firestore);

  beforeAll(() => EntityRegistry.register(ACCOUNTS, Account));
  afterAll(() => EntityRegistry.unregister(ACCOUNTS));

  async function setup() {
    await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
    await accounts.create(new Account(new AccountId(alice), 100));
    await accounts.create(new Account(new AccountId(bob), 0));

    const eventBus = new InMemoryEventBus(new InMemoryEventStore());
    const published: string[] = [];
    for (const name of [MoneyWithdrawn.NAME, MoneyDeposited.NAME]) {
      eventBus.subscribe(name, {
        getName: () => `recorder-${name}`,
        subscribedTo: () => [name],
        handle: async event => {
          published.push(event.getEventName());
        },
      });
    }

    return { eventBus, published };
  }

  it("moves the money and publishes both events after commit", async () => {
    const { eventBus, published } = await setup();

    await transfer(runner, accounts, eventBus, { from: alice, to: bob, amount: 30 }, "corr-1");

    expect((await accounts.findByID(alice))?.balance).toBe(70);
    expect((await accounts.findByID(bob))?.balance).toBe(30);
    expect(published).toEqual([MoneyWithdrawn.NAME, MoneyDeposited.NAME]);
  });

  it("changes nothing and publishes nothing when the transfer fails", async () => {
    const { eventBus, published } = await setup();

    await expect(
      transfer(runner, accounts, eventBus, { from: alice, to: bob, amount: 500 }, "corr-2"),
    ).rejects.toBeInstanceOf(InsufficientFunds);

    expect((await accounts.findByID(alice))?.balance).toBe(100);
    expect((await accounts.findByID(bob))?.balance).toBe(0);
    expect(published).toEqual([]);
  });
});
```

## Checklist

- [ ] `uow` passed to every DAO call of the change.
- [ ] In a transaction, every read (including inside `save`, `exists`, `deleteByID`) happens before the first write.
- [ ] Nothing but DAO calls inside the transaction callback; events returned and published after `run`.
- [ ] Batches chunked and created fresh per chunk; `begin()` before `commit()`.
- [ ] Emulator tests cover commit and abort.
