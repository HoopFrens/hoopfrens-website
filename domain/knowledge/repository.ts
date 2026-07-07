import type { EntityId } from "../shared/types";
import type { KnowledgeEntity } from "./types";

export interface KnowledgeRepository {
  listByWorkspace(workspaceId: EntityId): Promise<KnowledgeEntity[]>;
  getById(entityId: EntityId): Promise<KnowledgeEntity | null>;
  create(entity: KnowledgeEntity): Promise<KnowledgeEntity>;
  update(entityId: EntityId, entity: Partial<KnowledgeEntity>): Promise<KnowledgeEntity>;
}
