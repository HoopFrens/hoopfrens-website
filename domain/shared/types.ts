import type { VerificationStatus } from "./enums";

export type EntityId = string;
export type ISODateString = string;

export type BusinessObjectType =
  | "knowledge"
  | "project"
  | "asset"
  | "person"
  | "organization"
  | "decision"
  | "workspace"
  | "conversation"
  | "productionPackage"
  | "source"
  | "event";

export interface Source {
  id: EntityId;
  title: string;
  type: "document" | "url" | "file" | "conversation" | "manualEntry";
  url?: string;
  assetId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: EntityId;
  reliability: VerificationStatus;
  notes?: string;
}
