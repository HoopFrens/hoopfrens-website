import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { Event, Workspace } from "./types";

export const workspaceConverter = createFirestoreConverter<Workspace>();
export const eventConverter = createFirestoreConverter<Event>();
