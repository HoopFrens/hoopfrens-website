import type { EntityId } from "../shared/types";
import type { Decision } from "./types";

export interface DecisionRepository {
  listByWorkspace(workspaceId: EntityId): Promise<Decision[]>;
  getById(decisionId: EntityId): Promise<Decision | null>;
  create(decision: Decision): Promise<Decision>;
  update(decisionId: EntityId, decision: Partial<Decision>): Promise<Decision>;
}
