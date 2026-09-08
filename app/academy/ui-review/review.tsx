"use client";

import { useState } from "react";
import { AcademyOperationsDashboard } from "@/components/academy/AcademyOperationsDashboard";
import { AcademyQuickCourseForm } from "@/components/academy/AcademyQuickCourseForm";
import { AcademyCourseWorkspace } from "@/components/academy/AcademyCourseWorkspace";
import { CourseForm } from "../courses/CourseForm";
import { academyPreviewCourses, academyPreviewApplications, academyPreviewKitOrders, academyPreviewInstructors, academyPreviewClasses } from "@/lib/academy/preview";
import type { CourseInput } from "@/lib/academy/courses";

/** Development-only presentation harness. Saves remain in React state; uses AuthGate's existing local fixture. */
export function AcademyUiReview() {
  const [scenario, setScenario] = useState("normal");
  const [screen, setScreen] = useState<"home" | "create" | "edit">("home");
  const [draft, setDraft] = useState<CourseInput | null>(null);
  const [notice, setNotice] = useState("");
  const [failSave, setFailSave] = useState(false);
  const course = draft ? { ...academyPreviewCourses[0], id: "00000000-0000-4000-8000-000000000999", name: draft.name, price: draft.price, code: draft.code, is_published: false, feature_settings: draft.featureSettings } : null;
  function navigate(event: React.MouseEvent) {
    const anchor = (event.target as Element).closest("a");
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (scenario !== "normal" && !href.endsWith("/new") && !href.startsWith("#")) { setNotice("この状態は表示確認用です。実際のローカル一覧への移動は「通常運営」に切り替えて確認してください。"); return; }
    const path = href.split("?")[0];
    if (path.endsWith("/new")) setScreen("create");
    else if (course && href === `/academy/courses/${course.id}`) setScreen("edit");
    else if (path === "/academy/courses") window.location.assign("/academy/courses?preview=walkthrough");
    else if (path.startsWith("/academy/courses/") || path.startsWith("/academy/classes/") || path.startsWith("/academy/applications/")) window.location.assign(`${href}${href.includes("?") ? "&" : "?"}preview=walkthrough`);
    else if (["/academy/applications", "/academy/instructors", "/academy/classes"].includes(path)) window.location.assign(`${href}${href.includes("?") ? "&" : "?"}preview=walkthrough`);
    else setNotice("この確認ページではホーム・下書き作成・内容編集を試せます。その他の実画面はローカルのAcademyから確認します。");
  }
  return <main className="min-h-screen bg-white px-4 py-5 text-[var(--mikke-text)] sm:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 rounded-xl border border-[#ffd370] bg-white p-3 text-sm leading-6"><strong>ローカルの操作確認</strong> — 実際の画面部品を使っています。保存はこの画面内のみで、再読み込みすると消えます。本番への登録・課金・公開は行いません。</div>
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="確認画面"><button className="min-h-11 rounded-xl border bg-white px-4" onClick={() => setScreen("home")}>ホーム</button><button className="min-h-11 rounded-xl border bg-white px-4" onClick={() => setScreen("create")}>講座をつくる</button>{draft ? <button className="min-h-11 rounded-xl border bg-white px-4" onClick={() => setScreen("edit")}>編集を続ける</button> : null}<label className="flex items-center gap-2 px-2 text-xs"><input type="checkbox" checked={failSave} onChange={event => setFailSave(event.target.checked)} />保存エラーを確認</label></nav>
      {screen === "home" ? <label className="mb-4 block text-sm">表示状態の確認（ローカルのサンプル） <select className="min-h-11 border px-3" value={scenario} onChange={event => { setScenario(event.target.value); setNotice(""); }}><option value="normal">通常運営</option><option value="empty">初回・登録なし</option><option value="busy">対応が多い日</option><option value="error">取得失敗</option></select></label> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl bg-[#ffd370] p-3 text-sm">{notice}</p> : null}
      <div onClickCapture={navigate}>
        {screen === "home" ? scenario === "error" ? <div role="alert" className="border p-5"><h2 className="font-bold">ダッシュボードを読み込めませんでした</h2><p className="mt-2 text-sm">取得できない情報を0件・0円として表示していません。</p><button className="mt-3 min-h-11 border px-4" onClick={()=>setScenario("normal")}>再取得の成功状態を確認</button></div> : <AcademyOperationsDashboard name="確認用Academy" scope="local-review" data={{
          courses: scenario === "empty" ? [] : course ? [course, ...academyPreviewCourses] : academyPreviewCourses,
          apps: scenario === "empty" ? [] : scenario === "busy" ? Array.from({length:9}, (_,i)=>({...academyPreviewApplications[i % academyPreviewApplications.length], id: `review-app-${i}`, created_at: new Date().toISOString(), status:"received" as const, payment_status:"unpaid" as const})) : academyPreviewApplications,
          kits: scenario === "empty" ? [] : scenario === "busy" ? Array.from({length:6}, (_,i)=>({...academyPreviewKitOrders[i % academyPreviewKitOrders.length], id:`review-kit-${i}`, status:"preparing" as const})) : academyPreviewKitOrders,
          instructors: scenario === "empty" ? [] : academyPreviewInstructors,
          classes: scenario === "empty" ? [] : academyPreviewClasses
        }} /> : null}
        {screen === "create" ? <AcademyQuickCourseForm onSubmit={async input => { if (failSave) throw new TypeError("network"); setDraft(input); setScreen("edit"); }} /> : null}
        {screen === "edit" && draft && course ? <AcademyCourseWorkspace course={course} activeTab="settings"><CourseForm initial={draft} submitLabel="変更を保存する" onSubmit={async input => { if (failSave) throw new TypeError("network"); setDraft(input); }} /></AcademyCourseWorkspace> : null}
      </div>
    </div>
  </main>;
}
