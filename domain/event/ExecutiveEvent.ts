import type { ProjectWorkspace } from "../project/types";
import type { EntityId, ISODateString } from "../shared";
import type { ExecutiveEventType } from "./ExecutiveEventType";

export interface ExecutiveEventProjectReference {
  id: EntityId;
  title: string;
}

export interface ExecutiveEvent {
  id: EntityId;
  workspaceId: EntityId;
  actorId: EntityId;
  timestamp: ISODateString;
  eventType: ExecutiveEventType;
  projectId: EntityId;
  project: ExecutiveEventProjectReference;
  summary: string;
  relatedWorkspace: ProjectWorkspace;
  projectHref: string;
}

export type ExecutiveTimelineGroupLabel = "Today" | "Yesterday" | "Earlier";

export interface ExecutiveTimelineGroup {
  label: ExecutiveTimelineGroupLabel;
  events: ExecutiveEvent[];
}
