"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { DeliveryTaskInstruction } from "@/lib/team-works-delivery";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

// 工程の作業指示(何を・目的・どれで・作業順・提出物・完成物)を編集する共通UI。
// ジェネレーター・テンプレート編集・プロジェクト詳細の3か所から使う。
// 保存のタイミングは呼び出し側が決める(ここは制御コンポーネント)。
export function TeamWorksTaskInstructionEditor({
  value,
  onChange
}: {
  value: DeliveryTaskInstruction;
  onChange: (next: DeliveryTaskInstruction) => void;
}) {
  function patch(next: Partial<DeliveryTaskInstruction>) {
    onChange({ ...value, ...next });
  }

  return (
    <div className="grid gap-3">
      <TeamWorksProjectField label="何を作るか" helper="完成する成果物を一文で。例：1日ワークショップで講師が使用する公式スライド">
        <textarea
          value={value.description ?? ""}
          onChange={(event) => patch({ description: event.target.value || null })}
          rows={2}
          className={`${teamWorksProjectInputClass} resize-y`}
        />
      </TeamWorksProjectField>
      <TeamWorksProjectField label="目的" helper="なぜこれをやるか。例：どの講師が開催しても同じ内容・同じ品質で伝えるため">
        <textarea
          value={value.purpose ?? ""}
          onChange={(event) => patch({ purpose: event.target.value || null })}
          rows={2}
          className={`${teamWorksProjectInputClass} resize-y`}
        />
      </TeamWorksProjectField>
      <TeamWorksProjectField label="どれで(使うツール・方法)" helper="例：Canvaまたはスライド制作ツール">
        <input
          value={value.method ?? ""}
          onChange={(event) => patch({ method: event.target.value || null })}
          className={teamWorksProjectInputClass}
        />
      </TeamWorksProjectField>

      <StringListField
        label="作業順"
        helper="担当者が上から順に進める手順。"
        placeholder="例：スライド構成を作る"
        items={value.checklist}
        onChange={(checklist) => patch({ checklist })}
        ordered
      />

      <StringListField
        label="完成物に含まれるもの"
        helper="出来上がりに何が入っているか。"
        placeholder="例：mikkeOSの理念"
        items={value.outputs}
        onChange={(outputs) => patch({ outputs })}
      />

      <TeamWorksProjectField label="提出物の説明" helper="上の「何を提出するか」が種別、ここはその中身。例：スライドファイルまたはCanva共有URL">
        <input
          value={value.deliverableNote ?? ""}
          onChange={(event) => patch({ deliverableNote: event.target.value || null })}
          className={teamWorksProjectInputClass}
        />
      </TeamWorksProjectField>
    </div>
  );
}

function StringListField({
  label,
  helper,
  placeholder,
  items,
  onChange,
  ordered = false
}: {
  label: string;
  helper: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  ordered?: boolean;
}) {
  function update(index: number, text: string) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? text : item)));
  }

  function remove(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <span className="text-xs font-bold text-[var(--mikke-text)]">{label}</span>
      <div className="mt-1.5 space-y-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-center text-[11px] font-extrabold text-[var(--mikke-muted)]">
              {ordered ? index + 1 : "・"}
            </span>
            <input
              value={item}
              onChange={(event) => update(index, event.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] bg-white px-2.5 py-1.5 text-sm"
            />
            {ordered ? (
              <>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30">
                  <ArrowUp size={12} />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30">
                  <ArrowDown size={12} />
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => remove(index)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--tw-action)]">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, ""])} className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-2.5 py-1.5 text-[11px] font-bold">
        <Plus size={12} /> {label}を追加
      </button>
      <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{helper}</span>
    </div>
  );
}

// 担当者・クライアントが読むための表示専用ビュー。何も入っていなければ何も出さない。
export function TeamWorksTaskInstructionView({ instruction }: { instruction: DeliveryTaskInstruction }) {
  const hasContent =
    Boolean(instruction.description || instruction.purpose || instruction.method || instruction.deliverableNote) ||
    instruction.checklist.length > 0 ||
    instruction.outputs.length > 0;
  if (!hasContent) return null;

  return (
    <div className="space-y-2.5 text-sm">
      {instruction.description ? (
        <div>
          <p className="text-xs font-extrabold text-[var(--mikke-muted)]">何を作るか</p>
          <p className="mt-0.5 leading-6">{instruction.description}</p>
        </div>
      ) : null}
      {instruction.purpose ? (
        <div>
          <p className="text-xs font-extrabold text-[var(--mikke-muted)]">目的</p>
          <p className="mt-0.5 leading-6">{instruction.purpose}</p>
        </div>
      ) : null}
      {instruction.method ? (
        <div>
          <p className="text-xs font-extrabold text-[var(--mikke-muted)]">どれで</p>
          <p className="mt-0.5 leading-6">{instruction.method}</p>
        </div>
      ) : null}
      {instruction.checklist.length > 0 ? (
        <div>
          <p className="text-xs font-extrabold text-[var(--mikke-muted)]">作業順</p>
          <ol className="mt-1 space-y-0.5">
            {instruction.checklist.map((item, index) => (
              <li key={index} className="text-sm leading-6">{index + 1}. {item}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {instruction.outputs.length > 0 ? (
        <div>
          <p className="text-xs font-extrabold text-[var(--mikke-muted)]">完成物に含まれるもの</p>
          <ul className="mt-1 space-y-0.5">
            {instruction.outputs.map((item, index) => (
              <li key={index} className="text-sm leading-6">・{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {instruction.deliverableNote ? (
        <div>
          <p className="text-xs font-extrabold text-[var(--mikke-muted)]">提出物</p>
          <p className="mt-0.5 leading-6">{instruction.deliverableNote}</p>
        </div>
      ) : null}
    </div>
  );
}

// DeliveryTask等から作業指示だけを取り出す。
export function toTaskInstruction(source: DeliveryTaskInstruction): DeliveryTaskInstruction {
  return {
    description: source.description,
    purpose: source.purpose,
    method: source.method,
    deliverableNote: source.deliverableNote,
    checklist: source.checklist,
    outputs: source.outputs
  };
}
