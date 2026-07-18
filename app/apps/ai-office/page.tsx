"use client";

// mikke AI OFFICE — AI社員と人が一緒に働くバーチャルオフィス（MVP）
// API接続なし・localStorage保存。実行レイヤーは lib/ai-office/agent-runtime.ts に分離。

import { useState } from "react";
import { ActivityLogPanel } from "@/components/ai-office/ActivityLogPanel";
import { CaseBoard } from "@/components/ai-office/CaseBoard";
import { NewCaseModal } from "@/components/ai-office/NewCaseModal";
import { OfficeFloor } from "@/components/ai-office/OfficeFloor";
import { OfficeSidebar } from "@/components/ai-office/OfficeSidebar";
import { QuickActions } from "@/components/ai-office/QuickActions";
import { WorkloadMonitor } from "@/components/ai-office/WorkloadMonitor";
import { executeAgentTask } from "@/lib/ai-office/agent-runtime";
import { employeeById } from "@/lib/ai-office/data";
import { useOfficeStore, type NewCaseInput } from "@/lib/ai-office/store";

export default function AiOfficePage() {
  const store = useOfficeStore();
  const { state, hydrated, addCase, setCaseStatus, setCaseAssignee, appendLog } = store;
  const [modalOpen, setModalOpen] = useState(false);

  async function handleNewCase(input: NewCaseInput) {
    const created = addCase(input);
    setModalOpen(false);
    // AI社員に仕事を振る（今はmock：返事だけログに流れる）
    const employee = employeeById[input.assigneeId];
    if (employee) {
      const result = await executeAgentTask({ case: created, employee });
      if (result.ok) appendLog(employee.id, result.message);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7fb] text-[#1e2a4a]">
      <OfficeSidebar onlineCount={12} />

      <main className="min-w-0 flex-1 px-4 py-4 lg:px-6">
        {/* ヘッダー */}
        <header className="flex flex-wrap items-center gap-3 pb-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1e2a4a]">mikke AI OFFICE</h1>
          <p className="text-sm text-[#6b7280]">AI社員と人が一緒に働くバーチャルオフィス</p>
          <span className="rounded-full border border-[#d8dcea] bg-white px-3 py-1 text-xs text-[#6b7280]">
            mikkeOS 連携中
          </span>
        </header>

        {/* オフィスフロア（ドット絵） */}
        <OfficeFloor cases={state.cases} hydrated={hydrated} />

        {/* 案件ボード・稼働モニター・ログ */}
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <CaseBoard
            cases={state.cases}
            onStatusChange={setCaseStatus}
            onAssigneeChange={setCaseAssignee}
            onNewCase={() => setModalOpen(true)}
          />
          <WorkloadMonitor cases={state.cases} />
          <ActivityLogPanel logs={state.logs} />
        </div>

        <QuickActions
          onNewCase={() => setModalOpen(true)}
          onSendMessage={() => appendLog("miketa", "全社にメッセージを送りました")}
          onCreateMeeting={() => appendLog("yu", "会議を設定しました（進捗確認）")}
        />
      </main>

      <NewCaseModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleNewCase} />
    </div>
  );
}
