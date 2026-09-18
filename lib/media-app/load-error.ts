export function mediaLoadError(cause: unknown) {
  const error = cause && typeof cause === "object" ? cause as {code?:string;status?:number;name?:string} : {};
  if (error.code === "MEDIA_SESSION_CHANGED") return {code:"SESSION", message:"ログイン状態が変わりました。もう一度読み込んでください。"};
  if (error.code === "MEDIA_LOGIN_REQUIRED" || error.status === 401) return {code:"AUTH", message:"ログインの有効期限を確認できませんでした。もう一度読み込んでください。"};
  if (error.status === 429) return {code:"BUSY", message:"アクセスが集中しています。少し待ってから読み込んでください。"};
  if (["42501","PGRST301","PGRST302"].includes(error.code??"")) return {code:"ACCESS", message:"記事へのアクセスを確認できませんでした。もう一度読み込んでください。"};
  if (["42P01","42703","PGRST200","PGRST202","PGRST204","PGRST205"].includes(error.code??"")) return {code:"DATA", message:"記事の読み込み設定に問題があります。確認コードをお知らせください。"};
  if (error.name === "AuthRetryableFetchError" || error.name === "TypeError") return {code:"NETWORK", message:"通信が途切れました。接続を確認して読み込み直してください。"};
  return {code:"LOAD", message:"記事を読み込めませんでした。もう一度読み込んでください。"};
}
