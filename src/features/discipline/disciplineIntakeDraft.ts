const DRAFT_DATABASE = "sportstack-discipline-drafts";
const DRAFT_STORE = "intake-drafts";
const DRAFT_VERSION = 1;
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type DisciplineIntakeDraftEnvelope<T> = {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  value: T;
};

export function disciplineIntakeDraftKey(
  userId: string,
  associationId: string,
) {
  return `${userId}:${associationId}`;
}

export function createDisciplineIntakeDraftEnvelope<T>(
  value: T,
  savedAt = new Date(),
): DisciplineIntakeDraftEnvelope<T> {
  return {
    version: DRAFT_VERSION,
    savedAt: savedAt.toISOString(),
    value,
  };
}

export function isRestorableDisciplineIntakeDraft<T>(
  value: unknown,
  now = new Date(),
): value is DisciplineIntakeDraftEnvelope<T> {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<DisciplineIntakeDraftEnvelope<T>>;
  if (envelope.version !== DRAFT_VERSION || !envelope.savedAt) return false;
  const savedAt = new Date(envelope.savedAt).getTime();
  return (
    Number.isFinite(savedAt)
    && savedAt <= now.getTime()
    && now.getTime() - savedAt <= MAX_DRAFT_AGE_MS
    && "value" in envelope
  );
}

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot save the incident draft locally."));
      return;
    }
    const request = indexedDB.open(DRAFT_DATABASE, DRAFT_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE)) {
        request.result.createObjectStore(DRAFT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The incident draft could not be opened."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The incident draft could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The incident draft save was cancelled."));
  });
}

export async function loadDisciplineIntakeDraft<T>(key: string) {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, "readonly");
    const request = transaction.objectStore(DRAFT_STORE).get(key);
    const result = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("The incident draft could not be read."));
    });
    if (!isRestorableDisciplineIntakeDraft<T>(result)) {
      return null;
    }
    return result;
  } finally {
    database.close();
  }
}

export async function saveDisciplineIntakeDraft<T>(key: string, value: T) {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    transaction.objectStore(DRAFT_STORE).put(
      createDisciplineIntakeDraftEnvelope(value),
      key,
    );
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function clearDisciplineIntakeDraft(key: string) {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    transaction.objectStore(DRAFT_STORE).delete(key);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}
