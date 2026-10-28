// Log contexts hold plain data only. Loggers may clone or serialize them (the kernel's
// InMemoryLogger uses structured cloning), while Firestore references, snapshots, queries,
// units of work and user entities can carry functions that cannot be cloned.

export function unitOfWorkKind(uow?: object): string | null {
  return uow ? uow.constructor.name : null;
}

export function entityId(entity: unknown): unknown {
  return (entity as { id?: { value?: unknown } } | null | undefined)?.id?.value ?? null;
}

export function entityIds(entities: unknown[]): unknown[] {
  return entities.map(entityId);
}
