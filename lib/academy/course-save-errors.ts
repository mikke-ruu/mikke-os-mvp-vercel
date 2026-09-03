type AcademySaveErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function getAcademyCourseSaveErrorMessage(error: unknown) {
  const candidate = (error && typeof error === "object" ? error : {}) as AcademySaveErrorLike;
  const code = text(candidate.code);
  const source = `${text(candidate.message)} ${text(candidate.details)}`.toLowerCase();

  if (source.includes("academy_trial_expired") || source.includes("academy_access_inactive")) {
    return "お試し期間または利用期間が終了しているため保存できません。本部設定の「Academy利用料金」で利用状態を確認してください。";
  }
  if (source.includes("paid_readonly") || source.includes("write_allowed") || source.includes("read-only")) {
    return "現在の契約状態は閲覧のみのため保存できません。本部設定の「Academy利用料金」で支払い状態を確認してください。";
  }
  if (code === "42501" || source.includes("row-level security") || source.includes("permission denied") || source.includes("forbidden")) {
    return "この本部で講座を作成する権限を確認できませんでした。本部設定で役割とAcademyの利用状態を確認してください。";
  }
  if (code === "23505" || source.includes("duplicate key")) {
    return "同じ管理用コードの講座があります。管理用コードを変更するか、空欄にしてもう一度保存してください。";
  }
  if (code === "23514" || source.includes("check constraint")) {
    return "入力内容の組み合わせを保存できませんでした。受講形式・受付方法・教材の閲覧期間を確認してください。";
  }
  if (code === "PGRST204" || code === "PGRST202" || code === "42883") {
    return "Academyの保存設定を確認できませんでした。画面を再読み込みしても直らない場合は運営へお知らせください。";
  }
  if (error instanceof TypeError || source.includes("failed to fetch") || source.includes("network")) {
    return "通信が途中で切れたため保存できませんでした。通信状態を確認し、入力内容を残したままもう一度押してください。";
  }
  return "保存処理で問題が起きました。入力内容は消さず、画面を再読み込みする前に運営へお知らせください。";
}
