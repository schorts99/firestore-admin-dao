
# @schorts/firestore-admin-dao

[![npm version](https://badge.fury.io/js/%40schorts%2Ffirestore-admin-dao.svg)](https://badge.fury.io/js/%40schorts%2Ffirestore-admin-dao)

This module provides a type-safe, domain-driven abstraction over Firestore persistence. It integrates tightly with the `Model`, `Entity`, `Criteria` and `UnitOfWork` constructs from `@schorts/shared-kernel`, enabling expressive, consistent, and testable data access.

## Installation

This package has a peer dependency on `@schorts/shared-kernel`.

```bash
npm install @schorts/firestore-admin-dao @schorts/shared-kernel
```

## Usage

Here's a complete example of how to use the `FirestoreDAO` to interact with a collection.

### 1. Initialize Firebase Admin

```typescript
import { initializeApp, getFirestore, cert, Firestore } from '@schorts/firestore-admin-dao';

// This is your Firebase service account key file
const serviceAccount = require('./serviceAccountKey.json');

const app = initializeApp({
  credential: cert(serviceAccount),
});

const firestore = getFirestore(app);
```

### 2. Define your Entity

The `Entity` class is responsible for mapping between its properties and a plain object for persistence. It must implement `toPrimitives()` and a static `fromPrimitives()`. Note that `BaseModel` and `Entity` are imported from `@schorts/shared-kernel`.

```typescript
import { EntityRegistry } from "@schorts/firestore-admin-dao";
import { Entity as BaseEntity, Model as BaseModel, UUIDValue } from "@schorts/shared-kernel";

// This interface is a plain object representation of your entity.
interface MyEntityModel extends BaseModel {
  name: string;
  aNumber: number;
}

// This is your domain entity.
class MyEntity extends BaseEntity<UUIDValue, MyEntityModel> {
  constructor(
    id: UUIDValue,
    public readonly name: string,
    public readonly aNumber: number,
  ) {
    super(id);
  }

  // Converts the entity to a plain object for Firestore.
  toPrimitives(): MyEntityModel {
    return {
      id: this.id.value,
      name: this.name,
      aNumber: this.aNumber,
    };
  }

  // Creates an entity instance from a plain object retrieved from Firestore.
  static fromPrimitives<Model extends BaseModel>(model: Model): MyEntity {
    return new MyEntity(
      new UUIDValue(model.id),
      model.name,
      model.aNumber,
    );
  }
}

// Register the entity with a collection name. This is crucial!
EntityRegistry.register("my-entities", MyEntity);

```

### 3. Create a concrete DAO class

`FirestoreDAO` is abstract. Create a concrete class for your entity that extends it. Its constructor must pass a Firestore `CollectionReference` to the `super()` call.

```typescript
import { FirestoreDAO } from '@schorts/firestore-admin-dao';

class MyEntityDAO extends FirestoreDAO<MyEntityModel, MyEntity> {
  constructor(firestore: Firestore) {
    // The string passed to 'collection' is the name of your Firestore collection
    super(firestore.collection("my-entities"));
  }
}
```

### 4. Use the DAO for CRUD Operations

Now you can use your DAO to interact with Firestore. The `Criteria` class uses a fluent interface (builder pattern) to construct queries.

```typescript
import { Criteria, Operator, Direction, UUIDValue } from '@schorts/shared-kernel';

async function main() {
  const dao = new MyEntityDAO(firestore);

  // Create a new entity
  const entityId = UUIDValue.generate();
  const entity = new MyEntity(entityId, 'My Awesome Entity', 42);
  await dao.create(entity);
  console.log('Entity created with id:', entity.id.value);

  // Find an entity using the Criteria builder
  const criteria = new Criteria()
    .where('name', Operator.EQUAL, 'My Awesome Entity')
    .orderBy('aNumber', Direction.DESC)
    .limitResults(1);

  const foundEntity = await dao.findOneBy(criteria);
  console.log('Entity found:', foundEntity?.toPrimitives());

  // Update the entity
  if (foundEntity) {
    const updatedEntity = new MyEntity(foundEntity.id, 'My Updated Entity', 100);
    await dao.update(updatedEntity);
    console.log('Entity updated:', updatedEntity.toPrimitives());
  } 

  // Delete the entity
  if (foundEntity) {
    await dao.delete(foundEntity);
    console.log('Entity deleted');
  }
}

main();
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the LGPL-3.0-or-later License.
