import { createFirestoreConverter } from "../shared/firestoreConverters";
import type { Organization } from "./types";

export const organizationConverter = createFirestoreConverter<Organization>();
