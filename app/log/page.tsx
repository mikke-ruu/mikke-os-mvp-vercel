import { redirect } from "next/navigation";

/**
 * Activity Logは利用者に見せる画面ではなく、アプリ間をつなぐ内部台帳として扱う。
 * 顧客向けの一覧は公開しない（/os と同じ扱い）。
 */
export default function LogPage() {
  redirect("https://mikke-os.com/");
}
