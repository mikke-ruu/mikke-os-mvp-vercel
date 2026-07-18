"use client";

// mikke AI OFFICE — クイックアクション：メッセージを送る / 会議を作成する / 案件を新規作成

import { CalendarPlus, MessageCircle, Plus } from "lucide-react";

export function QuickActions({
  onNewCase,
  onSendMessage,
  onCreateMeeting
}: {
  onNewCase: () => void;
  onSendMessage: () => void;
  onCreateMeeting: () => void;
}) {
  return (
    <footer className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onSendMessage}
        className="flex items-center gap-1.5 rounded-full border border-[#e3e6f0] bg-white px-4 py-2 text-sm font-semibold text-[#1e2a4a] shadow-sm transition-colors hover:bg-[#f6f7fb]"
      >
        <MessageCircle className="h-4 w-4 text-[#6b7280]" />
        メッセージを送る
      </button>
      <button
        type="button"
        onClick={onCreateMeeting}
        className="flex items-center gap-1.5 rounded-full border border-[#e3e6f0] bg-white px-4 py-2 text-sm font-semibold text-[#1e2a4a] shadow-sm transition-colors hover:bg-[#f6f7fb]"
      >
        <CalendarPlus className="h-4 w-4 text-[#6b7280]" />
        会議を作成する
      </button>
      <button
        type="button"
        onClick={onNewCase}
        className="flex items-center gap-1.5 rounded-full bg-[#e58f65] px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02]"
      >
        <Plus className="h-4 w-4" />
        案件を新規作成
      </button>
    </footer>
  );
}
