"use client";

// mikke AI OFFICE — 中央メイン：ドット絵オフィスフロア（フェーズ2）。
// 建物全体は BuildingSvg（1枚のSVG）で描き、看板・案件バッジ・社員キャラ・
// ポップオーバーはSVGの上にHTMLオーバーレイで重ねる（座標はviewBox比率）。
// 社員の位置は roomForEmployee() で決まり、CSS transition で部屋間を移動して見える。

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { employeeById, employees, roomForCase, rooms, statusLabels } from "@/lib/ai-office/data";
import type { OfficeCase, RoomId } from "@/lib/ai-office/types";
import { BuildingSvg } from "./BuildingSvg";
import { FLOOR_H, FLOOR_W, pctX, pctY, roomRects, roomSpots } from "./floor-layout";
import {
  bubbleForEmployee,
  employeeStateDotColor,
  employeeStateLabel,
  getEmployeeState,
  roomForEmployee
} from "./office-helpers";
import { CoffeeMugMini, WorkerSprite } from "./pixel-sprites";

const statusChipStyle: Record<string, string> = {
  reception: "bg-[#eef4ff] text-[#2554c7]",
  working: "bg-[#fff3ea] text-[#c06a2e]",
  review: "bg-[#fffbe8] text-[#9c7d1a]",
  done: "bg-[#eefbf1] text-[#227a44]"
};

export function OfficeFloor({ cases, hydrated }: { cases: OfficeCase[]; hydrated: boolean }) {
  const [openRoom, setOpenRoom] = useState<RoomId | null>(null);
  const [sparkleMap, setSparkleMap] = useState<Record<string, number>>({});
  const [checkMap, setCheckMap] = useState<Record<string, number>>({});
  const prevCounts = useRef<Record<string, number> | null>(null);
  const prevDoneCounts = useRef<Record<string, number> | null>(null);
  const sparkleSeq = useRef(0);

  // 部屋ごとの未完了案件
  const casesByRoom = useMemo(() => {
    const map = new Map<RoomId, OfficeCase[]>();
    if (!hydrated) return map;
    for (const c of cases) {
      if (c.status === "done") continue;
      const roomId = roomForCase(c);
      map.set(roomId, [...(map.get(roomId) ?? []), c]);
    }
    return map;
  }, [cases, hydrated]);

  // 案件バッジが変化した部屋に短いキラキラを出す
  useEffect(() => {
    if (!hydrated) return;
    const next: Record<string, number> = {};
    for (const room of rooms) next[room.id] = casesByRoom.get(room.id)?.length ?? 0;
    const prev = prevCounts.current;
    prevCounts.current = next;
    if (!prev) return;
    const changed = Object.keys(next).filter((id) => prev[id] !== next[id]);
    if (changed.length === 0) return;
    sparkleSeq.current += 1;
    const seq = sparkleSeq.current;
    setSparkleMap((m) => {
      const copy = { ...m };
      for (const id of changed) copy[id] = seq;
      return copy;
    });
    const timer = setTimeout(() => {
      setSparkleMap((m) => {
        const copy = { ...m };
        for (const id of changed) if (copy[id] === seq) delete copy[id];
        return copy;
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [casesByRoom, hydrated]);

  // 案件が完了になった社員の頭上に小さなチェックを出す
  useEffect(() => {
    if (!hydrated) return;
    const next: Record<string, number> = {};
    for (const emp of employees) {
      next[emp.id] = cases.filter((c) => c.assigneeId === emp.id && c.status === "done").length;
    }
    const prev = prevDoneCounts.current;
    prevDoneCounts.current = next;
    if (!prev) return;
    const celebrated = Object.keys(next).filter((id) => next[id] > (prev[id] ?? 0));
    if (celebrated.length === 0) return;
    sparkleSeq.current += 1;
    const seq = sparkleSeq.current;
    setCheckMap((m) => {
      const copy = { ...m };
      for (const id of celebrated) copy[id] = seq;
      return copy;
    });
    const timer = setTimeout(() => {
      setCheckMap((m) => {
        const copy = { ...m };
        for (const id of celebrated) if (copy[id] === seq) delete copy[id];
        return copy;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [cases, hydrated]);

  // ポップオーバーは外側クリックで閉じる
  useEffect(() => {
    if (!openRoom) return;
    const close = () => setOpenRoom(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openRoom]);

  // 社員の配置（部屋＋部屋内の立ち位置）
  const placements = useMemo(() => {
    const countByRoom = new Map<RoomId, number>();
    return employees.map((emp) => {
      const roomId = hydrated ? roomForEmployee(emp, cases) : emp.homeRoomId;
      const idx = countByRoom.get(roomId) ?? 0;
      countByRoom.set(roomId, idx + 1);
      const spots = roomSpots[roomId];
      const [sx, sy] = spots[idx % spots.length];
      // スポット数を超えたら少し右へずらして重なりを避ける
      const overflow = idx >= spots.length ? Math.floor(idx / spots.length) * 34 : 0;
      return { emp, roomId, x: sx + overflow, y: sy };
    });
  }, [cases, hydrated]);

  // 未完了案件がある部屋はモニター画面が点滅する
  const activeRooms = useMemo(() => new Set<RoomId>(casesByRoom.keys()), [casesByRoom]);

  const openRoomCases = openRoom ? casesByRoom.get(openRoom) ?? [] : [];
  const openRoomRect = openRoom ? roomRects[openRoom] : null;

  return (
    <section className="rounded-2xl border border-[#e3e6f0] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1e2a4a]">オフィスフロア</h2>
        <p className="text-xs text-[#9aa3b2]">{hydrated ? "リアルタイム反映中" : "読み込み中…"}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="relative mx-auto w-full min-w-[960px]" style={{ aspectRatio: `${FLOOR_W} / ${FLOOR_H}` }}>
          <BuildingSvg activeRooms={activeRooms} />

          {/* ==== 部屋の看板 ==== */}
          {rooms.map((room) => {
            const rect = roomRects[room.id];
            return (
              <div
                key={room.id}
                className="absolute z-10 whitespace-nowrap rounded-md border border-[#0f1730] bg-[#1e2a4a] px-2 py-0.5 text-[10px] font-bold text-white shadow"
                style={{ left: pctX(rect.x + rect.w / 2), top: pctY(rect.y + 4), transform: "translateX(-50%)" }}
                title={room.description}
              >
                {room.name}
              </div>
            );
          })}
          <div
            className="absolute z-10 rounded-md border border-[#3d5a35] bg-[#4c7040] px-2 py-0.5 text-[10px] font-bold text-white shadow"
            style={{ left: pctX(30), top: pctY(672) }}
          >
            みっけテラス
          </div>

          {/* ==== 案件バッジ（クリックでその部屋の案件ポップオーバー） ==== */}
          {rooms.map((room) => {
            const count = casesByRoom.get(room.id)?.length ?? 0;
            if (count === 0) return null;
            const rect = roomRects[room.id];
            return (
              <button
                key={`badge-${room.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenRoom((cur) => (cur === room.id ? null : room.id));
                }}
                className="absolute z-20 flex items-center gap-0.5 rounded-full bg-[#e58f65] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md transition-transform hover:scale-110"
                style={{ left: pctX(rect.x + rect.w - 10), top: pctY(rect.y + 8), transform: "translateX(-100%)" }}
                aria-label={`${room.name}の案件 ${count}件を見る`}
              >
                <FileText className="h-3 w-3" />
                {count}
              </button>
            );
          })}

          {/* ==== バッジ変化のキラキラ ==== */}
          {Object.entries(sparkleMap).map(([roomId, seq]) => {
            const rect = roomRects[roomId as RoomId];
            if (!rect) return null;
            return (
              <span
                key={`sparkle-${roomId}-${seq}`}
                className="ai-office-sparkle pointer-events-none absolute z-30 text-[#ffb84d]"
                style={{ left: pctX(rect.x + rect.w - 66), top: pctY(rect.y + 6) }}
              >
                <Sparkles className="h-4 w-4" />
              </span>
            );
          })}

          {/* ==== 社員キャラ（位置は案件状態で変わり、transitionで移動） ==== */}
          {placements.map(({ emp, x, y }) => {
            const state = hydrated ? getEmployeeState(emp, cases) : "idle";
            const myCases = hydrated ? cases.filter((c) => c.assigneeId === emp.id && c.status !== "done") : [];
            return (
              <div
                key={emp.id}
                className="group absolute z-10"
                style={{
                  left: pctX(x),
                  top: pctY(y),
                  transform: "translate(-50%, -100%)",
                  transition: "left 1.6s ease-in-out, top 1.6s ease-in-out"
                }}
              >
                {/* 作業中はたまに吹き出し */}
                {state === "working" && (
                  <span
                    className="ai-office-bubble absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#e3e6f0] bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#1e2a4a] shadow-sm"
                    style={{ animationDelay: `${(emp.id.length % 4) * 1.3}s` }}
                  >
                    {bubbleForEmployee(emp.id)}
                  </span>
                )}
                {/* 案件を完了した瞬間の小さなチェック */}
                {checkMap[emp.id] !== undefined && (
                  <span className="ai-office-sparkle pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[#4caf6e]">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
                <div className={`relative flex flex-col items-center ${state === "idle" ? "ai-office-sway" : ""}`}>
                  {/* 休憩中はコーヒーを持つ */}
                  {state === "break" && (
                    <span className="absolute -right-3 bottom-7">
                      <CoffeeMugMini pixel={3} />
                    </span>
                  )}
                  <WorkerSprite employee={emp} pixel={3} />
                  <div className="mt-0.5 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 shadow-sm">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: employeeStateDotColor[state] }}
                    />
                    <span className="whitespace-nowrap text-[9px] font-bold leading-none text-[#1e2a4a]">
                      {emp.name}
                    </span>
                  </div>
                </div>

                {/* ホバーで役割・状態・担当案件のツールチップ */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-44 -translate-x-1/2 rounded-lg border border-[#e3e6f0] bg-white p-2 text-left shadow-lg group-hover:block">
                  <p className="text-[11px] font-bold text-[#1e2a4a]">
                    {emp.name}
                    <span className="ml-1 font-normal text-[#6b7280]">{emp.role}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#4b5563]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: employeeStateDotColor[state] }} />
                    {employeeStateLabel[state]}
                    {emp.kind === "ai" && (
                      <span className="ml-auto rounded bg-[#eef4ff] px-1 text-[9px] font-bold text-[#2554c7]">AI</span>
                    )}
                  </p>
                  {myCases.length > 0 && (
                    <ul className="mt-1 border-t border-[#f0f1f6] pt-1">
                      {myCases.slice(0, 3).map((c) => (
                        <li key={c.id} className="truncate text-[9px] text-[#6b7280]">
                          ・{c.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}

          {/* ==== 部屋の案件ポップオーバー ==== */}
          {openRoom && openRoomRect && (
            <div
              className="absolute z-40 w-60 rounded-xl border border-[#e3e6f0] bg-white p-3 shadow-xl"
              style={
                openRoomRect.y > FLOOR_H / 2
                  ? {
                      left: pctX(Math.min(openRoomRect.x + openRoomRect.w - 60, FLOOR_W - 260)),
                      bottom: `${((1 - openRoomRect.y / FLOOR_H) * 100).toFixed(3)}%`,
                      transform: "translateX(-75%)"
                    }
                  : {
                      left: pctX(Math.min(openRoomRect.x + openRoomRect.w - 60, FLOOR_W - 260)),
                      top: pctY(openRoomRect.y + 34),
                      transform: "translateX(-75%)"
                    }
              }
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-bold text-[#1e2a4a]">
                {rooms.find((r) => r.id === openRoom)?.name}の案件（{openRoomCases.length}件）
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {openRoomCases.length === 0 && <li className="text-[11px] text-[#9aa3b2]">案件はありません</li>}
                {openRoomCases.map((c) => (
                  <li key={c.id} className="rounded-lg border border-[#f0f1f6] bg-[#fafbfd] p-1.5">
                    <p className="truncate text-[11px] font-semibold text-[#1e2a4a]">{c.title}</p>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[10px] text-[#6b7280]">{employeeById[c.assigneeId]?.name ?? "未定"}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusChipStyle[c.status]}`}>
                        {statusLabels[c.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
