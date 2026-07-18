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

type Look = {
  head: HeadKey;
  hair: string;
  /** ネクタイ・スカーフの色（胸元2×2） */
  tie?: string;
  /** エプロンの色（胴の中央ブロック） */
  apron?: string;
  /** ズボンの色（未指定はネイビー） */
  pants?: string;
};

/** 社員ごとの見た目バリエーション（data.tsは変更せず、id別にここで定義） */
const LOOKS: Record<string, Look> = {
  miketa: { head: "tuft", hair: "#3a2c22", tie: "#c93f2d" }, // 社長：ちょんまげ＋赤ネクタイ
  hakase: { head: "prof", hair: "#e8e4da", pants: "#5c5346" }, // 顧問AI：白髪＋メガネ
  aoi: { head: "long", hair: "#2f3e5c", tie: "#f5d76e" }, // 講座AI：紺ロング＋黄スカーフ
  momoko: { head: "long", hair: "#6b4632", apron: "#f6e7ec" }, // 編集：茶ロング＋エプロン
  rin: { head: "short", hair: "#b8552f", pants: "#7d6b91" }, // デザインAI：赤茶ショート
  coder: { head: "short", hair: "#31473a", pants: "#39404f" }, // 実装AI：深緑ショート
  yu: { head: "short", hair: "#22314f", tie: "#5a9367" }, // ファシリ：黒ショート＋緑ネクタイ
  fuku: { head: "short", hair: "#9a938d", apron: "#e0f2ea" } // サポート：グレーヘア＋ミントエプロン
};

const DEFAULT_LOOK: Look = { head: "short", hair: "#3a2c22" };

const ANTENNA_ROWS = [".......AA.......", ".......PP......."];

function setChar(row: string, index: number, ch: string): string {
  return row.slice(0, index) + ch + row.slice(index + 1);
}

function buildWorkerRows(employee: Employee, look: Look): string[] {
  const rows = [...HEADS[look.head], ...BODY_ROWS];
  if (employee.kind === "ai") {
    // 頭上にアンテナ（先端が光る）。上2行が空いているテンプレートのみ
    if (rows[0].indexOf("H") === -1) {
      rows[0] = ANTENNA_ROWS[0];
      rows[1] = ANTENNA_ROWS[1];
    }
    // 耳元に小さなイヤーデバイス（頭の輪郭に重ねる。髪型によって位置を調整）
    const [earL, earR] = rows[7][2] === "H" ? [2, 13] : [3, 12];
    rows[7] = setChar(setChar(rows[7], earL, "P"), earR, "P");
  }
  // ネクタイ・スカーフ（胸元の2×2）
  if (look.tie) {
    rows[11] = setChar(setChar(rows[11], 7, "T"), 8, "T");
    rows[12] = setChar(setChar(rows[12], 7, "T"), 8, "T");
  }
  // エプロン（胴の中央ブロック）
  if (look.apron) {
    for (const y of [12, 13, 14]) {
      for (let x = 5; x <= 10; x++) {
        if (rows[y][x] === "C") rows[y] = setChar(rows[y], x, "W");
      }
    }
  }
  return rows;
}

/**
 * 社員のドット絵キャラクター（16×20）。employee.color を服の色に使う。
 * 目は .px-eye（たまに瞬き）、AIのアンテナ先端は .px-glow（ゆっくり点滅）。
 */
export function WorkerSprite({ employee, pixel = 3 }: { employee: Employee; pixel?: number }) {
  const look = LOOKS[employee.id] ?? DEFAULT_LOOK;
  const rows = buildWorkerRows(employee, look);
  const colors: Record<string, string> = {
    H: look.hair,
    S: "#f2c9a0",
    E: "#2b2b33",
    K: "#efa8a1",
    G: "#3a3a44",
    C: employee.color,
    D: look.pants ?? "#2a3350",
    B: "#463227",
    A: "#ffd66e",
    P: "#8a97a8",
    T: look.tie ?? "#c93f2d",
    W: look.apron ?? "#f5efe4"
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

// ---- 休憩中の社員が持つ小さなコーヒーマグ（湯気つき） ----

const MUG_ROWS = ["s....", ".s...", "CCC.h", "CCCCh", "CCC.."];

export function CoffeeMugMini({ pixel = 3 }: { pixel?: number }) {
  return (
    <svg
      viewBox="0 0 5 5"
      width={5 * pixel}
      height={5 * pixel}
      shapeRendering="crispEdges"
      style={{ display: "block", flexShrink: 0 }}
    >
      {MUG_ROWS.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          if (ch === "s") {
            return (
              <rect key={`${x}-${y}`} className="ai-office-steam" x={x} y={y} width={1} height={1} fill="#ffffff" opacity={0.85} />
            );
          }
          return (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === "h" ? "#c9a06a" : "#e58f65"} />
          );
        })
      )}
    </svg>
  );
}
