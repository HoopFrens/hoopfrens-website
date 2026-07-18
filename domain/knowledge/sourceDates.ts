import type { ISODateString } from "../shared";
import { normalizeKnowledgeDateTimeInput, normalizeKnowledgeTimestamp } from "./dateTime";
import { KnowledgeValidationError } from "./validation";
import {
  type KnowledgeSource,
  type KnowledgeSourceCreateInput,
  type KnowledgeSourceReliability,
} from "./types";

export const knowledgeSourceDateValidationMessage = "Source could not be saved. Confirm the required dates and try again.";

export function parseRequiredKnowledgeSourceDate(value: string): ISODateString {
  const date = normalizeKnowledgeDateTimeInput(value);
  if (!date) throw new KnowledgeValidationError(knowledgeSourceDateValidationMessage);
  return date;
}

export function parseOptionalKnowledgeSourceDate(value: string): ISODateString | undefined {
  if (!value.trim()) return undefined;
  const date = normalizeKnowledgeDateTimeInput(value);
  if (!date) throw new KnowledgeValidationError(knowledgeSourceDateValidationMessage);
  return date;
}

export function formatKnowledgeSourceDateTimeLocal(value: ISODateString | Date = new Date()) {
  const normalized = value instanceof Date
    ? (Number.isFinite(value.getTime()) ? value.toISOString() : null)
    : normalizeKnowledgeTimestamp(value);
  if (!normalized) throw new KnowledgeValidationError(knowledgeSourceDateValidationMessage);
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw new KnowledgeValidationError(knowledgeSourceDateValidationMessage);
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export type ManualKnowledgeSourceInput = {
  id: string;
  workspaceId: string;
  title: string;
  url: string;
  publisher: string;
  sourceType: KnowledgeSource["sourceType"];
  accessedAt: string;
  publishedAt: string;
  reliability: KnowledgeSourceReliability;
  notes: string;
  projectIds: string[];
};

export function buildManualKnowledgeSource(input: ManualKnowledgeSourceInput): KnowledgeSourceCreateInput {
  const accessedAt = parseRequiredKnowledgeSourceDate(input.accessedAt);
  const publishedAt = parseOptionalKnowledgeSourceDate(input.publishedAt);
  const title = input.title.trim();
  const url = input.url.trim();
  const publisher = input.publisher.trim();
  const notes = input.notes.trim();

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    title,
    ...(url ? { url } : {}),
    ...(publisher ? { publisher } : {}),
    sourceType: input.sourceType,
    accessedAt,
    ...(publishedAt ? { publishedAt } : {}),
    reliability: input.reliability,
    ...(notes ? { notes } : {}),
    projectIds: input.projectIds,
  };
}
