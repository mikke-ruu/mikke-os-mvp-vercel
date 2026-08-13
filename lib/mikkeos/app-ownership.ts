import { supabase } from "@/lib/supabase/client";

export function isMarketNoteLoginDestination(nextPath: string) {
  return nextPath === "/marketnote"
    || nextPath.startsWith("/marketnote/")
    || nextPath.startsWith("/marketnote?");
}

/**
 * MarketNoteからログインを選んだ時だけ、本人の利用アプリとして記録する。
 * ログイン済みでページを閲覧しただけでは呼ばない。
 */
export async function markLoginDestinationAsOwned(nextPath: string) {
  if (!isMarketNoteLoginDestination(nextPath)) return;
  const { error } = await supabase.rpc("mikke_mark_marketnote_owned_from_login");
  if (error) throw error;
}
