export type IcsPreviewItem = {
  id: string;
  uid: string;
  occurrenceKey: string;
  title: string;
  status: "scheduled" | "cancelled";
  allDay: boolean;
  timeZone: string;
  localTime: string | null;
  dateKey: string;
  startsAt: string;
  endsAt: string;
};

export type ParsedIcsCalendar = {
  calendarName: string;
  events: unknown[];
  timeZoneIds: string[];
  warnings: string[];
};

export const ICS_PREVIEW_LIMITS: Readonly<{
  maxEvents: number;
  maxOccurrences: number;
  maxRecurrenceIterations: number;
}>;

export type IcsPreview = {
  calendarName: string;
  items: IcsPreviewItem[];
  duplicateCount: number;
  skippedCount: number;
  warnings: string[];
};

export function parseIcsCalendar(text: string): ParsedIcsCalendar;
export function buildIcsPreview(calendar: ParsedIcsCalendar, range: { from: string; to: string }): IcsPreview;
