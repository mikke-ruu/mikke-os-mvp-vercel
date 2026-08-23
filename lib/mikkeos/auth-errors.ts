export function getJapaneseAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "メールアドレスまたはパスワードが違います。入力内容をご確認ください。";
  if (normalized.includes("email not confirmed")) return "メールアドレスの確認が完了していません。確認コードを入力するか、確認メールをもう一度送ってください。";
  if (normalized.includes("token has expired") || normalized.includes("otp expired") || normalized.includes("invalid token") || normalized.includes("token is invalid")) return "確認コードが違うか、有効期限が切れています。コードを確認するか、確認メールをもう一度送ってください。";
  if (normalized.includes("user already registered") || normalized.includes("already been registered")) return "このメールアドレスは登録済みです。「ログイン」からお進みください。";
  if (normalized.includes("same password")) return "現在とは異なるパスワードを設定してください。";
  if (
    normalized.includes("password is known to be weak") ||
    normalized.includes("weak password") ||
    normalized.includes("data breach") ||
    normalized.includes("pwned")
  ) return "このパスワードは使用できません。名前や誕生日などを避け、推測されにくい別のパスワードで、もう一度お試しください。";
  if (normalized.includes("password should be at least") || normalized.includes("password must be at least")) return "パスワードは8文字以上で入力してください。";
  if (normalized.includes("signup is disabled")) return "現在、新規登録を受け付けていません。しばらくしてからお試しください。";
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) return "短時間に操作が集中しました。少し時間をおいてからお試しください。";
  if (normalized.includes("network") || normalized.includes("fetch")) return "通信できませんでした。接続状態を確認して、もう一度お試しください。";
  return "手続きを完了できませんでした。入力内容を確認して、もう一度お試しください。";
}
