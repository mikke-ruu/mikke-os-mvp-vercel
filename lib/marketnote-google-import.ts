import { supabase } from "@/lib/supabase/client";
import type { GoogleManualImportRequest } from "@/lib/marketnote-google-import-contract.mjs";

export type GoogleManualImportResult = {
  total: number;
};

export async function saveGoogleManualImport(request: GoogleManualImportRequest) {
  const { data, error } = await supabase.rpc("marketnote_import_google_calendar_manual", {
    p_source_calendar_key: request.sourceCalendarKey,
    p_source_label: request.sourceLabel,
    p_items: request.items
  });
  if (error) throw error;
  return data as unknown as GoogleManualImportResult;
}
