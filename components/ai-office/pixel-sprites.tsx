"use client";

// mikke AI OFFICE — ドット絵パーツ集。
// すべて <rect> グリッドで描くインラインSVG。画像ファイルは使わない。
// フェーズ2: キャラクターを16×20に拡大し、社員ごとの髪型・髪色で個性を出す。

import type { Employee } from "@/lib/ai-office/types";

/** 文字グリッドから crispEdges の rect 群を描く共通ヘルパー（単体SVGとして描画） */
export function PixelGrid({
  rows,
  colors,
  pixel = 4,
  className
}: {
  rows: string[];
  colors: Record<string, string>;
  pixel?: number;
  className?: string;
}) {
  const cols = rows[0]?.length ?? 0;
  const h = rows.length;
  return (
    <svg
      viewBox={`0 0 ${cols} ${h}`}
      width={cols * pixel}
      height={h * pixel}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {rows.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = colors[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

// ---- アプリロゴ（クマ顔・サイドバーで使用） ----

const BEAR_ROWS = ["E......E", "EEFFFFEE", "FFFFFFFF", "FWFFFFWF", "FFFFFFFF", "FFFNNFFF", "FFFFFFFF", "..FFFF.."];

export function AppBearIcon({ pixel = 4 }: { pixel?: number }) {
  return (
    <PixelGrid
      rows={BEAR_ROWS}
      colors={{ E: "#8a5a3a", F: "#e0a86b", W: "#2b2018", N: "#2b2018" }}
      pixel={pixel}
    />
  );
}

// ---- 社員キャラクター（16×20） ----
// 文字の意味: H=髪 S=肌 E=目 K=ほっぺ C=服(employee.color) D=ズボン B=靴
//             G=メガネ A=アンテナの光 P=アンテナ軸

const BODY_ROWS = [
  "....CCCCCCCC....",
  "..CCCCCCCCCCCC..",
  "..CCCCCCCCCCCC..",
  "..SCCCCCCCCCCS..",
  "..CCCCCCCCCCCC..",
  "...DDDDDDDDDD...",
  "...DDDD..DDDD...",
  "...DDDD..DDDD...",
  "...BBBB..BBBB..."
];

const HEAD_SHORT = [
  "................",
  "................",
  "....HHHHHHHH....",
  "...HHHHHHHHHH...",
  "...HHHHHHHHHH...",
  "...HSSSSSSSSH...",
  "...SSSSSSSSSS...",
  "...SSESSSSESS...",
  "...SSSSSSSSSS...",
  "...SKSSSSSSKS...",
  "....SSSSSSSS...."
];

const HEAD_LONG = [
  "................",
  "................",
  "....HHHHHHHH....",
  "...HHHHHHHHHH...",
  "..HHHHHHHHHHHH..",
  "..HHSSSSSSSSHH..",
  "..HHSSSSSSSSHH..",
  "..HHSESSSSESHH..",
  "..HHSSSSSSSSHH..",
  "..HHSKSSSSKSHH..",
  "..HH.SSSSSS.HH.."
];

const HEAD_TUFT = [
  ".......HH.......",
  "......HHHH......",
  "....HHHHHHHH....",
  "...HHHHHHHHHH...",
  "...HHHHHHHHHH...",
  "...HSSSSSSSSH...",
  "...SSSSSSSSSS...",
  "...SSESSSSESS...",
  "...SSSSSSSSSS...",
  "...SKSSSSSSKS...",
  "....SSSSSSSS...."
];

const HEAD_PROF = [
  "................",
  "................",
  "...HHHHHHHHHH...",
  "..HHHHHHHHHHHH..",
  "..HHHHHHHHHHHH..",
  "..HHSSSSSSSSHH..",
  "...SSSSSSSSSS...",
  "...GGEGGGGEGG...",
  "...SSSSSSSSSS...",
  "...SKSSSSSSKS...",
  "....SSSSSSSS...."
];

type HeadKey = "short" | "long" | "tuft" | "prof";

const HEADS: Record<HeadKey, string[]> = {
  short: HEAD_SHORT,
  long: HEAD_LONG,
  tuft: HEAD_TUFT,
  prof: HEAD_PROF
};

/** 社員ごとの見た目バリエーション（data.tsは変更せず、id別にここで定義） */
const LOOKS: Record<string, { head: HeadKey; hair: string }> = {
  miketa: { head: "tuft", hair: "#3a2c22" }, // 社長：ちょんまげ風
  hakase: { head: "prof", hair: "#e8e4da" }, // 顧問AI：白髪＋メガネ
  aoi: { head: "long", hair: "#2f3e5c" }, // 講座AI：紺のロング
  momoko: { head: "long", hair: "#6b4632" }, // 編集：茶のロング
  rin: { head: "short", hair: "#b8552f" }, // デザインAI：赤茶ショート
  coder: { head: "short", hair: "#31473a" }, // 実装AI：深緑ショート
  yu: { head: "short", hair: "#22314f" }, // ファシリ：黒ショート
  fuku: { head: "short", hair: "#9a938d" } // サポート：グレーヘア
};

const ANTENNA_ROWS = [".......AA.......", ".......PP......."];

function buildWorkerRows(employee: Employee): string[] {
  const look = LOOKS[employee.id] ?? { head: "short" as HeadKey, hair: "#3a2c22" };
  const rows = [...HEADS[look.head], ...BODY_ROWS];
  // AI社員は頭上にアンテナ（先端が光る）。上2行が空いているテンプレートのみ
  if (employee.kind === "ai" && rows[0].indexOf("H") === -1) {
    rows[0] = ANTENNA_ROWS[0];
    rows[1] = ANTENNA_ROWS[1];
  }
  return rows;
}

/**
 * 社員のドット絵キャラクター（16×20）。employee.color を服の色に使う。
 * 目は .px-eye（たまに瞬き）、AIのアンテナ先端は .px-glow（ゆっくり点滅）。
 */
export function WorkerSprite({ employee, pixel = 3 }: { employee: Employee; pixel?: number }) {
  const look = LOOKS[employee.id] ?? { head: "short" as HeadKey, hair: "#3a2c22" };
  const rows = buildWorkerRows(employee);
  const colors: Record<string, string> = {
    H: look.hair,
    S: "#f2c9a0",
    E: "#2b2b33",
    K: "#efa8a1",
    G: "#3a3a44",
    C: employee.color,
    D: "#2a3350",
    B: "#463227",
    A: "#ffd66e",
    P: "#8a97a8"
  };
  return (
    <svg
      viewBox="0 0 16 20"
      width={16 * pixel}
      height={20 * pixel}
      shapeRendering="crispEdges"
      style={{ display: "block", flexShrink: 0 }}
    >
      {rows.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = colors[ch];
          if (!fill) return null;
          if (ch === "E") {
            // 瞬きで目が消えた瞬間に肌色が見えるよう下地を敷く
            return (
              <g key={`${x}-${y}`}>
                <rect x={x} y={y} width={1} height={1} fill={colors.S} />
                <rect className="px-eye" x={x} y={y} width={1} height={1} fill={fill} />
              </g>
            );
          }
          if (ch === "A") {
            return <rect key={`${x}-${y}`} className="px-glow" x={x} y={y} width={1} height={1} fill={fill} />;
          }
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}
