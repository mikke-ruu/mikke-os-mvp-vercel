"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Bot, CheckCircle2, CircleDashed, Code2, ImageIcon, Loader2, MessageCircle, Paperclip, Play, Plus, Send, ShieldCheck, UserRound } from "lucide-react";
import {
  createImplementationConversation,
  openImplementationAttachment,
  sendImplementationMessage,
  uploadImplementationAttachments,
  type ImplementationAttachment,
  type ImplementationConversation,
  type ImplementationMessage,
  type ImplementationMessageMode,
  type ImplementationProject,
} from "@/lib/implementation-center";

const conversationStatusLabel: Record<ImplementationConversation["status"], string> = {
  active: "相談できます",
  queued: "受付待ち",
  responding: "回答を整理中",
  executing: "実装中",
  waiting_user: "確認待ち",
  archived: "保管",
};

function statusTone(status: ImplementationConversation["status"]) {
  if (status === "executing" || status === "responding") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "queued") return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "waiting_user") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ImplementationConversationPanel({
  project,
  conversations,
  messages,
  attachments,
  userId,
  onChanged,
}: {
  project: ImplementationProject | null;
  conversations: ImplementationConversation[];
  messages: ImplementationMessage[];
  attachments: ImplementationAttachment[];
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const projectId = project?.id ?? null;
  const roomConversations = useMemo(
    () => conversations.filter((conversation) => conversation.project_id === projectId),
    [conversations, projectId],
  );
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingMode, setSavingMode] = useState<ImplementationMessageMode | "">("");
  const [error, setError] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomConversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(roomConversations[0]?.id ?? "");
    }
  }, [roomConversations, selectedConversationId]);

  const selectedConversation = roomConversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.conversation_id === selectedConversationId),
    [messages, selectedConversationId],
  );
  const awaitingCodex = selectedConversation
    ? ["queued", "responding", "executing"].includes(selectedConversation.status)
    : false;

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [visibleMessages.length, selectedConversation?.status]);

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingMode("discussion");
    setError("");
    try {
      const conversationId = await createImplementationConversation({
        projectId,
        title: String(data.get("title") || "").trim(),
      });
      const attachmentIds = await uploadImplementationAttachments({ conversationId, files: draftFiles, userId });
      await sendImplementationMessage({
        conversationId,
        mode: "discussion",
        content: String(data.get("content") || "").trim(),
        attachmentIds,
      });
      form.reset();
      setDraftFiles([]);
      setCreating(false);
      setSelectedConversationId(conversationId);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "相談を開始できませんでした。");
    } finally {
      setSavingMode("");
    }
  }

  async function sendMessage(form: HTMLFormElement, mode: ImplementationMessageMode) {
    if (!selectedConversation) return;
    const data = new FormData(form);
    const content = String(data.get("content") || "").trim();
    if (!content) return;
    setSavingMode(mode);
    setError("");
    try {
      const attachmentIds = await uploadImplementationAttachments({ conversationId: selectedConversation.id, files: draftFiles, userId });
      await sendImplementationMessage({ conversationId: selectedConversation.id, mode, content, attachmentIds });
      form.reset();
      setDraftFiles([]);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "メッセージを送れませんでした。");
    } finally {
      setSavingMode("");
    }
  }

  async function executeRecommendation(message: ImplementationMessage) {
    if (!selectedConversation || !message.recommended_execution) return;
    setSavingMode("execution"); setError("");
    try {
      await sendImplementationMessage({
        conversationId: selectedConversation.id,
        mode: "execution",
        content: message.recommended_execution,
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "実行依頼を送れませんでした。");
    } finally { setSavingMode(""); }
  }

  function collectPastedImages(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (!pasted.length) return;
    event.preventDefault();
    setDraftFiles((current) => [...current, ...pasted].slice(0, 3));
  }

  function AttachmentPicker() {
    return <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">
        <Paperclip size={14} />スクショ・画像を添付
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={(event) => setDraftFiles(Array.from(event.target.files ?? []).slice(0, 3))} />
      </label>
      {draftFiles.length ? <div className="flex flex-wrap gap-2">{draftFiles.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-800"><ImageIcon size={12} />{file.name}<button type="button" aria-label={`${file.name}を外す`} onClick={() => setDraftFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div> : null}
    </div>;
  }

  const roomName = project?.app_name ?? "mikkeOS全体";

  return <section className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm">
    <div className="border-b border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--mikke-primary)]">APP CONSULTATION ROOM</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-bold"><MessageCircle size={19} />{roomName} 相談室</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">質問やアイデア相談を続け、内容が決まったら同じ会話から実装へ移せます。</p>
        </div>
        <button type="button" onClick={() => setCreating((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold"><Plus size={15} />新しい話題</button>
      </div>
      {roomConversations.length ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{roomConversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${conversation.id === selectedConversationId ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"}`}>{conversation.title}</button>)}</div> : null}
    </div>

    {creating || roomConversations.length === 0 ? <form onSubmit={startConversation} className="grid gap-3 border-b border-[var(--mikke-line-soft)] p-4 md:p-5">
      <label className="text-xs font-bold">話題<input name="title" required maxLength={160} placeholder={`例：${roomName}は今どこまで進んでいますか？`} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-normal" /></label>
      <label className="text-xs font-bold">最初の質問<textarea name="content" required maxLength={12000} rows={3} onPaste={collectPastedImages} placeholder="気になったことを、そのまま書いてください。スクショは貼り付けもできます。" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-normal" /></label>
      <AttachmentPicker />
      <div className="flex gap-2"><button disabled={savingMode !== ""} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{savingMode ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}相談を始める</button>{roomConversations.length ? <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-[var(--mikke-line)] px-4 py-2.5 text-xs font-bold">閉じる</button> : null}</div>
    </form> : null}

    {selectedConversation ? <>
      <div className="flex items-center gap-2 border-b border-[var(--mikke-line-soft)] px-4 py-3 md:px-5">
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone(selectedConversation.status)}`}>{conversationStatusLabel[selectedConversation.status]}</span>
        {selectedConversation.branch_ref ? <span className="truncate text-[10px] text-[var(--mikke-muted-light)]">{selectedConversation.branch_ref}</span> : null}
      </div>
      <div className="max-h-[520px] space-y-4 overflow-y-auto p-4 md:p-5">
        {visibleMessages.map((message) => {
          const messageAttachments = attachments.filter((attachment) => attachment.message_id === message.id);
          return <article key={message.id} className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          {message.role === "assistant" ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Bot size={16} /></span> : null}
          <div className={`max-w-[85%] break-words rounded-2xl px-3.5 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[var(--mikke-primary)] text-white" : message.status === "failed" ? "border border-red-200 bg-red-50 text-red-800" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-ink)]"}`}>
            {message.mode === "execution" ? <p className={`mb-1.5 flex items-center gap-1 text-[10px] font-bold ${message.role === "user" ? "text-blue-100" : "text-blue-700"}`}><Code2 size={12} />実行依頼</p> : null}
            <p className="whitespace-pre-wrap">{message.content}</p>
            {messageAttachments.length ? <div className="mt-2 flex flex-wrap gap-2">{messageAttachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void openImplementationAttachment(attachment.storage_path).catch((cause) => setError(cause instanceof Error ? cause.message : "画像を開けませんでした。"))} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${message.role === "user" ? "border-white/30 bg-white/10" : "border-blue-200 bg-blue-50 text-blue-800"}`}><ImageIcon size={12} />{attachment.file_name}</button>)}</div> : null}
            {message.evidence_ref ? <p className="mt-2 border-t border-current/10 pt-2 text-[10px] opacity-70">証拠: {message.evidence_ref}</p> : null}
            {message.role === "assistant" && message.decision_question && message.recommended_execution ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><p className="text-xs font-bold">{message.decision_question}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={awaitingCodex || savingMode !== ""} onClick={() => void executeRecommendation(message)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Play size={13} />この内容で実行する</button><button type="button" onClick={() => document.getElementById("implementation-chat-input")?.focus()} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold">相談を続ける</button></div></div> : null}
          </div>
          {message.role === "user" ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"><UserRound size={16} /></span> : null}
        </article>})}
        {awaitingCodex ? <div className="flex items-center gap-2 text-xs font-semibold text-[var(--mikke-muted)]"><CircleDashed size={15} className="animate-spin text-blue-600" />{selectedConversation.progress_note || (selectedConversation.status === "executing" ? "Codexが専用worktreeで実装しています…" : "Codexが状況を確認して回答を作っています…")}</div> : null}
        <div ref={messageEndRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void sendMessage(event.currentTarget, "discussion"); }} className="border-t border-[var(--mikke-line-soft)] p-4 md:p-5">
        <textarea id="implementation-chat-input" aria-label={`${roomName}相談室へのメッセージ`} name="content" required maxLength={12000} rows={3} onPaste={collectPastedImages} disabled={awaitingCodex || savingMode !== ""} placeholder={awaitingCodex ? "Codexの返答を待っています。" : "質問や追加アイデアを書いてください。スクショは貼り付けもできます。"} className="w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm disabled:bg-slate-50" />
        <div className="mt-2"><AttachmentPicker /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={awaitingCodex || savingMode !== ""} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{savingMode === "discussion" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}相談を続ける</button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-5 text-[var(--mikke-muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" />相談が実行可能な内容まで固まると、Codexから実行確認を表示します。公開・課金・法務・本番DB操作は別の確認待ちで止まります。</p>
      </form>
    </> : <div className="p-8 text-center text-sm text-[var(--mikke-muted)]"><CheckCircle2 className="mx-auto mb-2 text-emerald-600" />新しい話題から相談を始められます。</div>}
    {error ? <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</p> : null}
  </section>;
}
