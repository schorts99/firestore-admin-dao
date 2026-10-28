# Testing rules

## Two layers

| What | How |
| --- | --- |
| Application and domain code that uses a DAO | Depend on the kernel's `DAO<Model, Entity>` type and test with the kernel's `InMemoryDAO`. No Firestore needed. |
| The `FirestoreDAO` subclass itself: mapping, queries, indexes, transactions | Integration tests against the Firestore emulator. |

- Do not mock `firebase-admin` to test a DAO subclass. A mock cannot tell you whether a query needs an index, whether a transaction reads after writing, or how `Timestamp`s round-trip.
- `InMemoryDAO` does not enforce Firestore's limits: it accepts `LIKE` and `BETWEEN`, needs no indexes, and allows reads after writes. Code that relies on those behaviors must also be covered by an emulator test.
- Code that receives a `FirestoreUnitOfWorkRunner` or `FirestoreBatchUnitOfWork` needs the emulator, since those units of work only work with a `FirestoreDAO`.

## Emulator tests

- Start the emulator (`firebase emulators:start --only firestore`, or `gcloud emulators firestore start`) and set `FIRESTORE_EMULATOR_HOST` (for example `127.0.0.1:8080`). The Admin SDK then connects to it without credentials.
- Use a fixed demo project ID (`demo-test`) so nothing can reach a real project.
- Clear data between tests with `DELETE http://$FIRESTORE_EMULATOR_HOST/emulator/v1/projects/<projectId>/databases/(default)/documents`.
- Skip emulator suites when `FIRESTORE_EMULATOR_HOST` is not set, so unit test runs stay fast, and run them in CI with the emulator.
- The emulator does not enforce composite indexes. Keep `firestore.indexes.json` in sync by hand, or by running the queries once against a real test project.
- Register entities in `beforeAll` and unregister them in `afterAll`; `EntityRegistry` is global.

## Loggers

- Pass `new InMemoryLogger("debug")` to a DAO to assert on what it logs; contexts are plain data (paths, IDs, sizes, criteria, document data).

See [skills/test-firestore-daos](../skills/test-firestore-daos/SKILL.md).
