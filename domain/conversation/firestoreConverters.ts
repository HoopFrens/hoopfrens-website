import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { Conversation } from "./types";

export const conversationConverter = createFirestoreConverter<Conversation>();
