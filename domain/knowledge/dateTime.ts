import type { ISODateString } from "../shared";

const isoTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

type CalendarDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year: number, month: number) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] || 0;
}

function milliseconds(value: string | undefined) {
  return Number((value || "").padEnd(3, "0"));
}

function hasValidCalendarParts(parts: CalendarDateTimeParts) {
  return parts.month >= 1
    && parts.month <= 12
    && parts.day >= 1
    && parts.day <= daysInMonth(parts.year, parts.month)
    && parts.hour >= 0
    && parts.hour <= 23
    && parts.minute >= 0
    && parts.minute <= 59
    && parts.second >= 0
    && parts.second <= 59
    && parts.millisecond >= 0
    && parts.millisecond <= 999;
}

function parts(match: RegExpMatchArray): CalendarDateTimeParts {
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
    millisecond: milliseconds(match[7]),
  };
}

/** Strictly validates persisted Knowledge Graph ISO timestamps, including real calendar dates. */
export function isStrictKnowledgeTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string") return false;
  const match = value.match(isoTimestampPattern);
  if (!match || !hasValidCalendarParts(parts(match))) return false;
  if (match[8] !== "Z" && (Number(match[10]) > 23 || Number(match[11]) > 59)) return false;
  return Number.isFinite(new Date(value).getTime());
}

/** Returns the equivalent canonical UTC instant, or null when the timestamp is malformed. */
export function normalizeKnowledgeTimestamp(value: unknown): ISODateString | null {
  if (!isStrictKnowledgeTimestamp(value)) return null;
  return new Date(value).toISOString();
}

/**
 * Normalizes a browser datetime-local value or a strict persisted timestamp.
 * Local values are round-tripped through the host timezone so nonexistent local
 * times (for example, a daylight-saving gap) cannot silently drift.
 */
export function normalizeKnowledgeDateTimeInput(value: unknown): ISODateString | null {
  if (typeof value !== "string") return null;
  const normalizedTimestamp = normalizeKnowledgeTimestamp(value.trim());
  if (normalizedTimestamp) return normalizedTimestamp;

  const match = value.trim().match(localDateTimePattern);
  if (!match) return null;
  const dateParts = parts(match);
  if (!hasValidCalendarParts(dateParts)) return null;

  const date = new Date(0);
  date.setFullYear(dateParts.year, dateParts.month - 1, dateParts.day);
  date.setHours(dateParts.hour, dateParts.minute, dateParts.second, dateParts.millisecond);
  if (!Number.isFinite(date.getTime())
    || date.getFullYear() !== dateParts.year
    || date.getMonth() !== dateParts.month - 1
    || date.getDate() !== dateParts.day
    || date.getHours() !== dateParts.hour
    || date.getMinutes() !== dateParts.minute
    || date.getSeconds() !== dateParts.second
    || date.getMilliseconds() !== dateParts.millisecond) {
    return null;
  }
  return date.toISOString();
}
