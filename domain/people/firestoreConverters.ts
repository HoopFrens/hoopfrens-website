import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { Person } from "./types";

export const personConverter = createFirestoreConverter<Person>();
