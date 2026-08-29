"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Link2, ReceiptJapaneseYen, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters, updateHeadquarters } from "@/lib/academy/headquarters";
import {
  getMyAcademyBillingSnapshot,
  type AcademyBillingSnapshot,
} from "@/lib/academy/billing";
import {
  getMyHeadquartersRole,
  inviteHeadquartersMember,
  listHeadquartersInvitations,
  listHeadquartersMembers,
  listMyHeadquartersInvitations,
  respondHeadquartersInvitation,
  stopHeadquartersMember
} from "@/lib/academy/headquarters-settings";
import {
  ACADEMY_COMMUNITY_REVOCATION_NOTICE,
  getAcademyCommunityClaimStopErrorMessage,
  getAcademyCommunityLinkErrorMessage,
  listMyAcademyCommunityLinkOptions,
  saveAcademyCommunityRoomLink,
  stopAcademyCommunityClaimAccess,
  type AcademyCommunityLinkOption
} from "@/lib/academy/community-links";
import type {
  AcademyHeadquarters,
  AcademyHeadquartersInvitation,
  AcademyHeadquartersMember,
  AcademyHeadquartersRole
} from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const cardClass = "rounded-2xl border border-[var(--mikke-line)] bg-white p-5";

const roleLabels: Record<AcademyHeadquartersRole, string> = {
  owner: "Owner",
  administrator: "Administrator",
  course_editor: "Course Editor"
};

const roleDetails = [
  { role: "Owner", permissions: "本部情報、メンバー、講座、公開を含むすべての管理" },
  { role: "Administrator", permissions: "本部情報、メンバー招待、講座運営（所有権の変更を除く）" },
  { role: "Course Editor", permissions: "講座、公開講座ページ、教材の編集" }
];

function SettingsContent() {
  const { profile } = useAuth();
  const [headquarters, setHeadquarters] = useState<AcademyHeadquarters | null>(null);
  const [role, setRole] = useState<AcademyHeadquartersRole | null>(null);
  const [members, setMembers] = useState<AcademyHeadquartersMember[]>([]);
  const [invitations, setInvitations] = useState<AcademyHeadquartersInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<AcademyHeadquartersInvitation[]>([]);
  const [billingSnapshot, setBillingSnapshot] = useState<AcademyBillingSnapshot | null>(null);
  const [communityLinks, setCommunityLinks] = useState<AcademyCommunityLinkOption[]>([]);
  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    contact_email: "",
    renewal_period_months: "",
    next_instructor_number: "",
    default_payment_note: ""
  });
  const [inviteMikkeId, setInviteMikkeId] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<AcademyHeadquartersRole, "owner">>("administrator");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [communityForm, setCommunityForm] = useState({ communityId: "", mappingId: "", entitlementKey: "", sourceProductKey: "academy-membership", status: "draft" as "draft" | "active" | "archived" });

  const canManage = role === "owner" || role === "administrator";
  const selectedCommunity = useMemo(
    () => communityLinks.find((item) => item.communityId === communityForm.communityId) ?? null,
    [communityForm.communityId, communityLinks]
  );
  const currentCommunityMappings = useMemo(
    () => selectedCommunity?.mappings.filter((mapping) => mapping.isCurrent) ?? [],
    [selectedCommunity]
  );
  const currentCommunityMapping = useMemo(
    () => currentCommunityMappings.find((mapping) => mapping.id === communityForm.mappingId) ?? null,
    [communityForm.mappingId, currentCommunityMappings]
  );
  const communityLinkHasActiveClaims = (currentCommunityMapping?.activeClaimCount ?? 0) > 0;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const pending = await listMyHeadquartersInvitations(profile.id);
      setMyInvitations(pending);

      const hq = await getOwnedHeadquarters(profile.user_id);
      setHeadquarters(hq);
      if (!hq) {
        setRole(null);
        setMembers([]);
        setInvitations([]);
        setBillingSnapshot(null);
        return;
      }

      const nextRole = await getMyHeadquartersRole(hq.id);
      setRole(nextRole);
      setForm({
        name: hq.name,
        logo_url: hq.logo_url ?? "",
        contact_email: hq.contact_email ?? "",
        renewal_period_months: hq.renewal_period_months?.toString() ?? "",
        next_instructor_number: hq.next_instructor_number?.toString() ?? "",
        default_payment_note: hq.default_payment_note ?? ""
      });

      if (nextRole === "owner" || nextRole === "administrator") {
        const [nextMembers, nextInvitations] = await Promise.all([
          listHeadquartersMembers(hq.id),
          listHeadquartersInvitations(hq.id)
        ]);
        setMembers(nextMembers);
        setInvitations(nextInvitations);
        try {
          const nextCommunityLinks = await listMyAcademyCommunityLinkOptions(hq.id);
          setCommunityLinks(nextCommunityLinks);
          const firstCommunity = nextCommunityLinks[0];
          const firstCurrentMapping = firstCommunity?.mappings.find((mapping) => mapping.isCurrent);
          const firstDefinition = firstCommunity?.definitions[0];
          if (firstCommunity && (firstCurrentMapping || firstDefinition)) {
            setCommunityForm({
              communityId: firstCommunity.communityId,
              mappingId: firstCurrentMapping?.id ?? "",
              entitlementKey: firstCurrentMapping?.entitlementKey ?? firstDefinition?.key ?? "",
              sourceProductKey: firstCurrentMapping?.sourceProductKey ?? "academy-membership",
              status: firstCurrentMapping?.status === "active" ? "active" : "draft"
            });
          }
        } catch {
          setCommunityLinks([]);
        }
      }
      setBillingSnapshot(
        nextRole === "owner" ? await getMyAcademyBillingSnapshot(hq.id) : null,
      );
    } catch {
      setMessage("本部設定を読み込めませんでした。DB設定と権限を確認してください。");
    } finally {
      setLoading(false);
    }
  }, [profile.id, profile.user_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members]
  );

  async function saveProfile() {
    if (!headquarters || !canManage) return;
    setBusy("profile");
    setMessage("");
    try {
      const updated = await updateHeadquarters(headquarters.id, {
        name: form.name.trim() || headquarters.name,
        logo_url: form.logo_url.trim() || null,
        contact_email: form.contact_email.trim() || null,
        renewal_period_months: form.renewal_period_months
          ? Number(form.renewal_period_months)
          : null,
        next_instructor_number: form.next_instructor_number
          ? Number(form.next_instructor_number)
          : null,
        default_payment_note: form.default_payment_note.trim() || null
      });
      setHeadquarters(updated);
      setMessage("本部情報を保存しました。");
    } catch {
      setMessage("本部情報を保存できませんでした。");
    } finally {
      setBusy("");
    }
  }

  async function inviteMember() {
    if (!headquarters || !canManage || !inviteMikkeId.trim()) return;
    setBusy("invite");
    setMessage("");
    try {
      await inviteHeadquartersMember(headquarters.id, inviteMikkeId, inviteRole);
      setInviteMikkeId("");
      setMessage("本部メンバーへ招待を送りました。");
      await load();
    } catch {
      setMessage("招待を送れませんでした。mikke IDと権限を確認してください。");
    } finally {
      setBusy("");
    }
  }

  async function respond(invitationId: string, response: "accepted" | "declined") {
    setBusy(invitationId);
    setMessage("");
    try {
      await respondHeadquartersInvitation(invitationId, response);
      setMessage(response === "accepted" ? "本部への招待を承認しました。" : "招待を辞退しました。");
      await load();
    } catch {
      setMessage("招待へ回答できませんでした。");
    } finally {
      setBusy("");
    }
  }

  async function stopMember(memberId: string) {
    setBusy(memberId);
    setMessage("");
    try {
      await stopHeadquartersMember(memberId);
      setMessage("本部メンバーの利用を停止しました。");
      await load();
    } catch {
      setMessage("メンバーを停止できませんでした。Owner権限を確認してください。");
    } finally {
      setBusy("");
    }
  }

  async function saveCommunityLink() {
    if (!headquarters || !canManage || !communityForm.communityId || !communityForm.entitlementKey) return;
    setBusy("community-link");
    setMessage("");
    try {
      await saveAcademyCommunityRoomLink({
        headquartersId: headquarters.id,
        communityId: communityForm.communityId,
        entitlementKey: communityForm.entitlementKey,
        sourceProductKey: communityForm.sourceProductKey,
        status: communityForm.status
      });
      setMessage(
        communityForm.status === "active"
          ? "Communityの指定Room連携を有効にしました。"
          : communityForm.status === "archived"
            ? "Community連携を停止しました。過去の接続履歴は保存されています。"
            : "Community連携を下書き保存しました。"
      );
      setCommunityLinks(await listMyAcademyCommunityLinkOptions(headquarters.id));
    } catch (error) {
      setMessage(getAcademyCommunityLinkErrorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function stopCommunityClaimAccess() {
    if (!headquarters || !currentCommunityMapping || !communityLinkHasActiveClaims) return;
    const confirmed = window.confirm(
      `Academyから追加したCommunity利用権 ${currentCommunityMapping.activeClaimCount}件を停止します。\n\n${ACADEMY_COMMUNITY_REVOCATION_NOTICE}\n\n停止後に元へ戻す場合は、対象者へ改めて案内と同意が必要です。続けますか？`
    );
    if (!confirmed) return;

    setBusy("community-claims");
    setMessage("");
    try {
      const result = await stopAcademyCommunityClaimAccess({
        headquartersId: headquarters.id,
        mappingId: currentCommunityMapping.id
      });
      const nextCommunityLinks = await listMyAcademyCommunityLinkOptions(headquarters.id);
      setCommunityLinks(nextCommunityLinks);
      const refreshedMapping = nextCommunityLinks
        .flatMap((community) => community.mappings)
        .find((mapping) => mapping.id === currentCommunityMapping.id);
      if ((refreshedMapping?.activeClaimCount ?? 0) === 0) {
        setMessage(`${result.stoppedCount}件のAcademy由来の利用権を停止しました。接続範囲の変更または連携停止を行えます。`);
      } else {
        setMessage(`${result.stoppedCount}件を停止しましたが、新しい利用権が追加されています。残り${refreshedMapping?.activeClaimCount ?? 0}件を確認してください。`);
      }
    } catch (error) {
      setMessage(getAcademyCommunityClaimStopErrorMessage(error));
      try {
        setCommunityLinks(await listMyAcademyCommunityLinkOptions(headquarters.id));
      } catch {
        // The safe message above remains visible. Never expose a raw database error.
      }
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">本部設定を確認しています…</p>;
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">
          {message}
        </p>
      ) : null}

      {myInvitations.length ? (
        <section className={cardClass}>
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--mikke-text)]">
            <UserPlus size={18} /> あなたへの本部招待
          </h2>
          <div className="mt-4 space-y-3">
            {myInvitations.map((invitation) => (
              <div key={invitation.id} className="rounded-xl border border-[var(--mikke-line)] p-4">
                <p className="text-sm font-bold">{invitation.headquarters?.name ?? "Academy本部"}</p>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                  役割: {roleLabels[invitation.role]}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy === invitation.id}
                    onClick={() => void respond(invitation.id, "declined")}
                    className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold"
                  >
                    辞退
                  </button>
                  <button
                    type="button"
                    disabled={busy === invitation.id}
                    onClick={() => void respond(invitation.id, "accepted")}
                    className="rounded-xl bg-[var(--mikke-primary)] px-3 py-2 text-sm font-bold text-white"
                  >
                    承認
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!headquarters ? (
        <p className={cardClass}>管理できる本部はありません。本部Ownerからの招待を確認してください。</p>
      ) : (
        <>
          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--mikke-text)]">
                  <Building2 size={18} /> 本部情報
                </h2>
                <p className="mt-1 text-sm text-[var(--mikke-muted)]">
                  公開ページの文章ではなく、本部運営に使う基本情報です。
                </p>
              </div>
              {role ? (
                <span className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold">
                  {roleLabels[role]}
                </span>
              ) : null}
            </div>

            {canManage ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold">本部名<input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="text-xs font-bold">ロゴURL<input className={inputClass} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></label>
                <label className="text-xs font-bold">問い合わせメール<input type="email" className={inputClass} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
                <label className="text-xs font-bold">認定の更新周期（月）<input type="number" min="1" className={inputClass} value={form.renewal_period_months} onChange={(e) => setForm({ ...form, renewal_period_months: e.target.value })} /></label>
                <label className="text-xs font-bold">次の講師番号<input type="number" min="1" className={inputClass} value={form.next_instructor_number} onChange={(e) => setForm({ ...form, next_instructor_number: e.target.value })} /></label>
                <label className="text-xs font-bold md:col-span-2">支払い案内の既定文<textarea rows={3} className={inputClass} value={form.default_payment_note} onChange={(e) => setForm({ ...form, default_payment_note: e.target.value })} /></label>
                <button type="button" disabled={busy === "profile"} onClick={() => void saveProfile()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white md:col-span-2">
                  本部情報を保存
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--mikke-muted)]">Course Editorは本部情報を変更できません。</p>
            )}
          </section>

          {role === "owner" ? (
            <section className={cardClass}>
              <h2 className="flex items-center gap-2 text-base font-bold">
                <ReceiptJapaneseYen size={18} /> Academy利用料金
              </h2>
              <p className="mt-1 text-sm text-[var(--mikke-muted)]">
                請求先の本部Ownerだけに表示しています。すべて税込です。
              </p>

              {billingSnapshot ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-4">
                    <p className="text-xs font-bold text-[var(--mikke-muted)]">月末の登録講師</p>
                    <p className="mt-1 text-2xl font-bold">{billingSnapshot.registered_instructor_count}<span className="ml-1 text-sm">名</span></p>
                  </div>
                  <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-4">
                    <p className="text-xs font-bold text-[var(--mikke-muted)]">{Number(billingSnapshot.charge_month.slice(5, 7))}月分</p>
                    <p className="mt-1 text-2xl font-bold">{billingSnapshot.charge_price_yen.toLocaleString()}<span className="ml-1 text-sm">円</span></p>
                  </div>
                  <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-4">
                    <p className="text-xs font-bold text-[var(--mikke-muted)]">通常料金</p>
                    <p className="mt-1 text-2xl font-bold">{billingSnapshot.catalog_price_yen.toLocaleString()}<span className="ml-1 text-sm">円</span></p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold">
                  最初の月末集計後に、登録講師数と次回料金を表示します。
                </p>
              )}

              {billingSnapshot?.price_notice_required ? (
                <p className="mt-3 rounded-xl border border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold">
                  21名または51名に到達したため、次月は現在の料金を据え置きます。人数が上限を超えたままの場合は、その次の更新月から通常料金になります。
                </p>
              ) : null}

              <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--mikke-line)] text-sm">
                <div className="grid min-w-[640px] grid-cols-[1fr_1.4fr_1.2fr] bg-[var(--mikke-surface-soft)] px-4 py-2 text-xs font-bold">
                  <span>登録講師数</span><span>月額</span><span>上限利用時の1名あたり</span>
                </div>
                {[
                  ["20名まで", "5,000円", "250円"],
                  ["50名まで", "10,000円", "200円"],
                  ["200名まで", "20,000円", "100円"],
                  ["201名以上", "20,000円＋超過1名100円", "人数により変動"],
                ].map((row) => (
                  <div key={row[0]} className="grid min-w-[640px] grid-cols-[1fr_1.4fr_1.2fr] gap-2 border-t border-[var(--mikke-line)] px-4 py-3">
                    {row.map((cell) => <span key={cell}>{cell}</span>)}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">
                登録中の講師を数えます。活動中・休眠・停止中も登録解除までは対象です。同じ人が同一本部で複数講座を担当しても1名です。本部Ownerも講師登録している場合は1名に含まれます。登録解除は翌月分から反映します。
              </p>
            </section>
          ) : null}

          {canManage ? (
            <section className={cardClass}>
              <h2 className="flex items-center gap-2 text-base font-bold"><Link2 size={18} /> Community連携</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
                AcademyとCommunityは別商品のまま、受講者や認定講師に指定Roomだけを追加料金なしで案内します。通常のCommunity会費や契約は変更しません。
              </p>
              {communityLinks.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-bold">接続するCommunity
                    <select className={inputClass} value={communityForm.communityId} onChange={(event) => {
                      const nextCommunity = communityLinks.find((item) => item.communityId === event.target.value);
                      const nextMapping = nextCommunity?.mappings.find((mapping) => mapping.isCurrent);
                      setCommunityForm({
                        communityId: event.target.value,
                        mappingId: nextMapping?.id ?? "",
                        entitlementKey: nextMapping?.entitlementKey ?? nextCommunity?.definitions[0]?.key ?? "",
                        sourceProductKey: nextMapping?.sourceProductKey ?? "academy-membership",
                        status: nextMapping?.status === "active" ? "active" : "draft"
                      });
                    }}>
                      {communityLinks.map((item) => <option key={item.communityId} value={item.communityId}>{item.communityName}</option>)}
                    </select>
                  </label>
                  {currentCommunityMappings.length ? (
                    <label className="text-xs font-bold md:col-span-2">管理する接続
                      <select className={inputClass} value={communityForm.mappingId} onChange={(event) => {
                        const nextMapping = currentCommunityMappings.find((mapping) => mapping.id === event.target.value);
                        if (!nextMapping) return;
                        setCommunityForm({
                          ...communityForm,
                          mappingId: nextMapping.id,
                          entitlementKey: nextMapping.entitlementKey,
                          sourceProductKey: nextMapping.sourceProductKey,
                          status: nextMapping.status === "active" ? "active" : "draft"
                        });
                      }}>
                        {currentCommunityMappings.map((mapping) => <option key={mapping.id} value={mapping.id}>{mapping.sourceProductKey}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <label className="text-xs font-bold">利用できるRoomの範囲
                    <select className={inputClass} value={communityForm.entitlementKey} onChange={(event) => setCommunityForm({ ...communityForm, entitlementKey: event.target.value })}>
                      {(communityLinks.find((item) => item.communityId === communityForm.communityId)?.definitions ?? []).map((definition) => <option key={definition.key} value={definition.key}>{definition.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold">Academy内の区分名
                    <input className={inputClass} value={communityForm.sourceProductKey} readOnly={Boolean(currentCommunityMapping)} onChange={(event) => setCommunityForm({ ...communityForm, sourceProductKey: event.target.value })} placeholder="例: basic-learner" />
                    {currentCommunityMapping ? <span className="mt-1 block text-[11px] leading-5 text-[var(--mikke-muted)]">利用中の接続を別の区分へ変更することはできません。新しい接続を追加する機能は今後対応します。</span> : null}
                  </label>
                  <label className="text-xs font-bold">状態
                    <select className={inputClass} value={communityForm.status} onChange={(event) => setCommunityForm({ ...communityForm, status: event.target.value as "draft" | "active" | "archived" })}>
                      <option value="draft">下書き（まだ案内しない）</option>
                      <option value="active">連携中（招待に利用する）</option>
                      {currentCommunityMapping ? <option value="archived">連携を停止する</option> : null}
                    </select>
                  </label>
                  {communityLinkHasActiveClaims ? (
                    <div className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--mikke-primary)] md:col-span-2">
                      <p>利用中（{currentCommunityMapping?.activeClaimCount}件）です。範囲変更や停止の前に、対象者のAcademy由来のCommunity利用権を停止してください。{ACADEMY_COMMUNITY_REVOCATION_NOTICE}</p>
                      <button type="button" disabled={busy === "community-claims"} onClick={() => void stopCommunityClaimAccess()} className="mt-3 rounded-xl border border-[var(--mikke-primary)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-40">
                        {busy === "community-claims" ? "停止しています…" : "Academy由来の利用権を停止"}
                      </button>
                    </div>
                  ) : null}
                  <button type="button" disabled={busy === "community-link" || !communityForm.entitlementKey || communityLinkHasActiveClaims} onClick={() => void saveCommunityLink()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 md:col-span-2">Community連携を保存</button>
                  {selectedCommunity?.mappings.length ? (
                    <div className="space-y-2 rounded-xl border border-[var(--mikke-line)] p-4 md:col-span-2">
                      <p className="text-sm font-bold">接続状況</p>
                      {selectedCommunity.mappings.map((mapping) => (
                        <div key={mapping.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>{mapping.sourceProductKey} / {mapping.entitlementKey}</span>
                          <span className="font-bold text-[var(--mikke-primary)]">
                            {mapping.status === "archived"
                              ? "過去の接続"
                              : mapping.status === "draft"
                                ? "下書き（まだ招待しない）"
                                : mapping.activeClaimCount > 0
                                  ? `利用中（${mapping.activeClaimCount}件）`
                                  : "連携中"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold">あなたが運営するCommunityと、Roomの利用範囲を先にCommunity側で作成してください。</p>
              )}
            </section>
          ) : null}

          <section className={cardClass}>
            <h2 className="flex items-center gap-2 text-base font-bold"><ShieldCheck size={18} /> 役割・権限</h2>
            <div className="mt-4 space-y-2">
              {roleDetails.map((item) => (
                <div key={item.role} className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3">
                  <p className="text-sm font-bold">{item.role}</p>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.permissions}</p>
                </div>
              ))}
            </div>
          </section>

          {canManage ? (
            <section className={cardClass}>
              <h2 className="flex items-center gap-2 text-base font-bold"><UserPlus size={18} /> 本部メンバー</h2>
              <p className="mt-1 text-sm text-[var(--mikke-muted)]">mikke IDで招待し、本人が承認すると利用可能になります。</p>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_12rem_auto]">
                <input className={inputClass} value={inviteMikkeId} onChange={(e) => setInviteMikkeId(e.target.value)} placeholder="mikke ID" />
                <select className={inputClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Exclude<AcademyHeadquartersRole, "owner">)}>
                  <option value="administrator">Administrator</option>
                  <option value="course_editor">Course Editor</option>
                </select>
                <button type="button" disabled={!inviteMikkeId.trim() || busy === "invite"} onClick={() => void inviteMember()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  招待
                </button>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3">
                  <Check size={16} />
                  <div><p className="text-sm font-bold">本部Owner</p><p className="text-xs text-[var(--mikke-muted)]">Owner ・ 利用中</p></div>
                </div>
                {activeMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{member.member?.display_name ?? "本部メンバー"} <span className="font-normal text-[var(--mikke-muted)]">@{member.member?.handle ?? ""}</span></p>
                      <p className="text-xs text-[var(--mikke-muted)]">{roleLabels[member.role]}</p>
                    </div>
                    <button type="button" disabled={busy === member.id || (role === "administrator" && member.role === "administrator")} onClick={() => void stopMember(member.id)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold disabled:opacity-40">
                      利用停止
                    </button>
                  </div>
                ))}
              </div>

              {invitations.some((item) => item.status === "pending") ? (
                <div className="mt-5">
                  <p className="text-xs font-bold">回答待ち</p>
                  {invitations.filter((item) => item.status === "pending").map((invitation) => (
                    <p key={invitation.id} className="mt-2 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm">
                      @{invitation.target?.handle ?? ""} ・ {roleLabels[invitation.role]}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function AcademySettingsPage() {
  return (
    <HonbuShell title="本部設定">
      <SettingsContent />
    </HonbuShell>
  );
}
