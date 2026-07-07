import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { Decision } from "./types";

export const decisionConverter = createFirestoreConverter<Decision>();
