# Unit of work rules

Applies to `FirestoreUnitOfWorkRunner`, `FirestoreTransactionUnitOfWork`, and `FirestoreBatchUnitOfWork`.

## Pick one

| Need | Use |
| --- | --- |
| Read, decide, then write, consistently (balances, counters, uniqueness checks) | `FirestoreUnitOfWorkRunner` (a Firestore transaction) |
| Write many documents atomically without reading them first (imports, fan-out) | `FirestoreBatchUnitOfWork` |
| A single write | No unit of work |

- Every `FirestoreDAO` method takes the unit of work as its second argument (after the entity, ID, or criteria). Pass it to every call that belongs to the change.
- Pass only these classes to a `FirestoreDAO`. A kernel `InMemoryUnitOfWork` or another adapter's unit of work fails at runtime.

## Transactions

```ts no-check
const events = await runner.run(async uow => {
  const account = await accounts.findByID(id, uow);   // reads first
  account!.withdraw(amount, correlationId);
  await accounts.update(account!, uow);                // then writes
  return account!.pullDomainEvents();
});
await eventBus.publishMany(events);                    // after commit
```

- Returning from the callback commits; throwing aborts and rethrows. `uow.rollback()` is not supported and throws, so throw instead.
- **All reads before any write.** Firestore rejects a read after a write in the same transaction. That includes the reads hidden in `save`, `deleteByID`, and `exists`: call `save(entity, uow)` before any write, or use `create`/`update` when you already know whether the document exists.
- **The callback can run several times.** Firestore retries it on contention, with fresh reads. Keep it free of side effects other than DAO calls with `uow`: no HTTP calls, no event publishing, no mutation of outer variables you rely on afterwards.
- There is no transactional outbox (`collectEventsFrom` does nothing here). Return events from the callback and publish them after `run` resolves; a crash between commit and publish loses them, so make subscribers tolerate missing or late events, or store events in the same transaction yourself.
- A transaction must finish within 270 seconds and stay idle for less than 60, and its commit must fit in a 10 MiB request. Keep transactions small and short.

## Batches

```ts no-check
const uow = new FirestoreBatchUnitOfWork(firestore, logger);
await uow.begin();
for (const product of chunk) await products.create(product, uow); // queued
await uow.commit();                                                // applied together
```

- Call `begin()` before `commit()`; committing an inactive batch throws `TransactionNotActive`. `rollback()` discards the queued writes.
- Reads (`findByID`, `search`, …) ignore the batch and see committed data only. `save`, `deleteByID`, and `exists` read outside the batch.
- `create` queued in a batch fails the whole commit if any of the documents exists. Use `update` or `save` for existing documents.
- One commit must fit in a 10 MiB request. Split large jobs into chunks (a few hundred documents each is a safe default) and commit each one; chunks are atomic individually, not together.
- A `FirestoreBatchUnitOfWork` is single-use per `begin`/`commit` cycle. Create a new one per chunk.

## With the command bus

The kernel's transactional command bus creates one unit of work per command and hands it to the handler as `context.unitOfWork`, typed as the kernel's `UnitOfWork`. A Firestore transaction cannot be created that way. Run `FirestoreUnitOfWorkRunner` inside the handler instead, and push the returned events to `context.events`.

See [skills/use-firestore-transactions](../skills/use-firestore-transactions/SKILL.md).
