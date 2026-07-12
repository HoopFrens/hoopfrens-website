import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { KnowledgeEntity } from "./types";

export const knowledgeEntityConverter = createFirestoreConverter<KnowledgeEntity>();
