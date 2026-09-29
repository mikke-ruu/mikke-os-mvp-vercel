"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { InstructorActivityShell } from "@/components/academy2/InstructorActivityShell";
import { InstructorActivitySettings } from "@/components/academy2/InstructorActivitySettings";
import { loadInstructorActivity, requestInstructorActivity, type ActivityRequestInput, type ActivityView } from "@/lib/academy2/activity";

function ActivityForm({ activityId }: { activityId: string }) {
  const { user } = useAuth();
  const [view, setView] = useState<ActivityView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(null);
    setView(null);
    if (!user) {
      setLoading(false);
      setLoadError("ログインして活動・契約を確認してください。");
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)) {
      setLoading(false);
      setLoadError("活動・契約の情報が見つかりませんでした。");
      return;
    }
    void loadInstructorActivity(activityId).then(data => {
      if (!current) return;
      if (data && data.id !== activityId) throw new Error("対象の活動・契約を確認できませんでした。");
      setView(data);
    }).catch((error: unknown) => {
      if (current) setLoadError(error instanceof Error ? error.message : "活動・契約を読み込めませんでした。");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [activityId, user, retry]);

  async function submit(input: ActivityRequestInput) {
    setSaveError(null);
    try {
      const data = await requestInstructorActivity(activityId, input);
      if (!data || data.id !== activityId) throw new Error("申請の保存結果を確認できませんでした。再読み込みして申請状況をご確認ください。");
      // The RPC returns the persisted activity and requests. Approval does not
      // imply a state transition when the server is holding it for review.
      setView(data);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "申請を保存できませんでした。入力内容は残っています。");
      throw error;
    }
  }

  if (loading) return <p role="status" className="text-sm">活動・契約を読み込んでいます…</p>;
  if (loadError) return <div role="alert" className="text-sm"><p>{loadError}</p><button type="button" className="mt-3 rounded-[9px] border border-[#e8e8eb] bg-white px-3 py-2 text-xs" onClick={() => setRetry(value => value + 1)}>もう一度読み込む</button></div>;
  if (!view) return <p className="text-sm">活動・契約の情報がありません。</p>;
  return <InstructorActivitySettings state={view} onSubmit={submit} error={saveError} />;
}

function ActivityIdentity({ activityId }: { activityId: string }) {
  const { user } = useAuth();
  return <ActivityForm key={`${user?.id ?? "signed-out"}:${activityId}`} activityId={activityId} />;
}

export default function InstructorActivityPage() {
  const params = useParams<{ id: string }>();
  return <InstructorActivityShell activityId={params.id}><ActivityIdentity activityId={params.id} /></InstructorActivityShell>;
}
