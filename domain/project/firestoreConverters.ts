import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { Project } from "./types";

export const projectConverter = createFirestoreConverter<Project>();
