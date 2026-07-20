import { redirect } from "next/navigation";

// AC-F1: 本部の申込管理を「本部受付」「講師受付」の2タブに統合したため、
// 独立していたキット発送ページはリダイレクトに置き換える。
// 中身（academy_kit_orders一覧・ステータス/入金のインライン変更）は
// app/academy/applications/page.tsx の「講師受付」タブへ移植済み。
export default function KitsPage() {
  redirect("/academy/applications");
}
