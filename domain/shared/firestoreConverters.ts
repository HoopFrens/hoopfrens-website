import type {
  DocumentData,
  FirestoreDataConverter,
  PartialWithFieldValue,
  QueryDocumentSnapshot,
  SetOptions,
  SnapshotOptions,
  WithFieldValue,
} from "firebase/firestore";

export const createFirestoreConverter = <T>(): FirestoreDataConverter<T> => {
  const toFirestore = (
    modelObject: WithFieldValue<T> | PartialWithFieldValue<T>,
    options?: SetOptions,
  ): DocumentData => {
    void options;
    return modelObject as DocumentData;
  };

  return {
    toFirestore,
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return snapshot.data(options) as T;
    },
  };
};
