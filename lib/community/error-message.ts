function errorDetail(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: "" };
  const value = error as { code?: unknown; message?: unknown; name?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : "",
    message: typeof value.message === "string" ? value.message : "",
  };
}

export function communityErrorMessage(error: unknown, fallback: string) {
  const { code, message } = errorDetail(error);
  const detail = `${code} ${message}`.toUpperCase();

  if (detail.includes("COMMUNITY_PLATFORM_OWNER_READ_ONLY")) {
    return "現在の契約状態では、新しいCommunityを作成できません。利用プラン・契約状態を確認してください。";
  }
  if (detail.includes("COMMUNITY_CREATE_AUTH_REQUIRED") || detail.includes("COMMUNITY_CREATE_ANONYMOUS_DENIED")
    || detail.includes("AUTH_REQUIRED")) {
    return "ログイン状態を確認できませんでした。もう一度ログインしてお試しください。";
  }
  if (detail.includes("FORBIDDEN") || detail.includes("PERMISSION DENIED")) {
    return "この操作を行う権限がありません。Communityを管理するアカウントでログインしているか確認してください。";
  }
  if (detail.includes("EXPIRED") || detail.includes("ENDED")) {
    return "利用期間が終了しています。利用プラン・契約状態を確認してください。";
  }
  if (detail.includes("COMMUNITY_CREATE_ENTITLEMENT_CONFLICT") || detail.includes("PLATFORM_BILLING_STATE_CONFLICT")
    || detail.includes("PLATFORM_BILLING_IDEMPOTENCY_CONFLICT")) {
    return "利用状態が更新されました。画面を再読み込みしてから、もう一度お試しください。";
  }
  if (/FAILED TO FETCH|FETCH FAILED|NETWORK ?ERROR|NETWORK REQUEST FAILED|LOAD FAILED/.test(detail)) {
    return "通信できませんでした。インターネット接続を確認して、もう一度お試しください。";
  }
  if (message.includes("Community name must be at least 2 characters")) {
    return "Community名は2文字以上で入力してください。";
  }
  if (message.includes("Slug must be 3-60 lowercase letters, numbers, or hyphens")) {
    return "URL用IDは3〜60文字の半角英数字とハイフンで入力してください。";
  }
  if (message.includes("This Community name or slug is reserved")) {
    return "そのCommunity名またはURL用IDは運営用に予約されています。別の名前を入力してください。";
  }
  if (message.includes("relation") || message.includes("column")) {
    return "COMMUNITYの準備が完了していません。時間をおいてもう一度お試しください。";
  }
  if (/[ぁ-んァ-ヶ一-龠]/.test(message)) return message;
  return fallback;
}
