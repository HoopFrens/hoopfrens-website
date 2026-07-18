import type {
  DocumentData,
  FirestoreDataConverter,
  PartialWithFieldValue,
  QueryDocumentSnapshot,
  SetOptions,
  SnapshotOptions,
  WithFieldValue,
} from "firebase/firestore";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeFirestoreDocument<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item === undefined) throw new Error("Firestore arrays cannot contain undefined values.");
      return sanitizeFirestoreDocument(item);
    }) as T;
  }
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => (
      item === undefined ? [] : [[key, sanitizeFirestoreDocument(item)]]
    )),
  ) as T;
}

export const createFirestoreConverter = <T>(): FirestoreDataConverter<T> => {
  const toFirestore = (
    modelObject: WithFieldValue<T> | PartialWithFieldValue<T>,
    options?: SetOptions,
  ): DocumentData => {
    void options;
    return sanitizeFirestoreDocument(modelObject) as DocumentData;
  };

  return {
    toFirestore,
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return snapshot.data(options) as T;
    },
  };
};
