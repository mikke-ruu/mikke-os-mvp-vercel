/** Supabase errors are plain objects, not necessarily Error instances. */
export function materialSaveErrorMessage(error: unknown): string {
  const value = error && typeof error === "object" ? error as { message?: unknown; code?: unknown } : {};
  const message = typeof value.message === "string" ? value.message : "";
  const keep = "入力内容はこの画面に残っています。";
  if (message.includes("academy_trial_publishing_unavailable")) {
    return `体験利用中は受講者への公開はできません。「受講者のマイページに表示する」を外して、下書きとして保存してください。${keep}`;
  }
  if (message.includes("academy_trial_live_feature_unavailable")) {
    return `現在の利用状態では、この保存操作は許可されていません。利用状態を確認してください。${keep}`;
  }
  if (message.includes("academy_access_inactive")) {
    return `利用期間が終了しているか、利用が停止されているため保存できません。利用状態を確認してください。${keep}`;
  }
  if (value.code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return `この教材を保存する権限がありません。ログイン中のアカウントと利用状態を確認してください。${keep}`;
  }
  if (value.code === "PGRST301" || value.code === "PGRST303" || message.includes("JWT expired")) {
    return `ログインの有効期限が切れています。入力内容を手元に控えてから、ログインし直してください。${keep}`;
  }
  return `保存を確認できませんでした。${keep}入力内容を手元にも控えたうえで、もう一度保存してください。`;
}
