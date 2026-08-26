import type { IcsPreviewItem } from "./marketnote-ics-preview.mjs";

export type GoogleManualImportItem = {
  source_record_id: string;
  occurrence_key: string;
  title: string;
  all_day: boolean;
  time_zone: string;
  starts_at?: string;
  ends_at?: string | null;
  starts_on?: string;
  ends_on_exclusive?: string;
  status: "active" | "cancelled";
};

export type GoogleManualImportRequest = {
  sourceCalendarKey: string;
  sourceLabel: string;
  items: GoogleManualImportItem[];
};

export function buildGoogleManualImportRequest(
  calendarName: string,
  items: IcsPreviewItem[]
): GoogleManualImportRequest;
