"use client";

// mikke AI OFFICE — フロア全体を1枚で描く建物SVG。
// 外壁・屋根・廊下・ドア・エントランス・部屋ごとの床と家具・みっけテラス。
// 名前ラベル・バッジ・キャラは OfficeFloor 側のHTMLオーバーレイで重ねる。

import type { RoomId } from "@/lib/ai-office/types";
import { FLOOR_W, FLOOR_H, corridorRect, passageRect, roomRects } from "./floor-layout";

// ---- 色 ----
const WALL = "#8a6a4c"; // 壁（部屋の間に見える色）
const ROOF = "#55402e";
const ROOF_TRIM = "#6d5340";
const DOOR_FRAME = "#4a3728";

/** 部屋の奥壁の色（淡い補助色は壁の一部・ラグ・小物のみに使う） */
const backWallColor: Partial<Record<RoomId, string>> = {
  reception: "#f4ecd9", // クリーム
  advisor: "#eae4f2", // ラベンダー
  course: "#e2ecf5", // ライトブルー
  editing: "#f6e7ec", // 淡いピンク
  design: "#f8e8e0", // 淡いコーラル
  coding: "#e0e4ea", // ブルーグレー
  meeting: "#e6f0e2", // ライトグリーン
  break: "#e0f2ea" // ミント
};

// ---- 小さなヘルパー ----

/** 文字グリッドを建物SVG内の座標に置く */
function Px({
  rows,
  colors,
  x,
  y,
  s = 4,
  className
}: {
  rows: string[];
  colors: Record<string, string>;
  x: number;
  y: number;
  s?: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={className}>
      {rows.map((row, ry) =>
        row.split("").map((ch, rx) => {
          const fill = colors[ch];
          if (!fill) return null;
          return <rect key={`${rx}-${ry}`} x={rx} y={ry} width={1} height={1} fill={fill} />;
        })
      )}
    </g>
  );
}

function Rug({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} opacity={0.9} />
      <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={2} />
    </g>
  );
}

function Desk({ x, y, w = 96 }: { x: number; y: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={8} fill="#d9ab77" />
      <rect x={x} y={y + 8} width={w} height={24} fill="#aa7850" />
      <rect x={x} y={y + 8} width={w} height={3} fill="#8d6440" />
      <rect x={x + 4} y={y + 32} width={8} height={10} fill="#6b4a2f" />
      <rect x={x + w - 12} y={y + 32} width={8} height={10} fill="#6b4a2f" />
    </g>
  );
}

function Monitor({ x, y, s = 5, on }: { x: number; y: number; s?: number; on?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={0} y={0} width={8} height={6} fill="#39404f" />
      <rect x={1} y={1} width={6} height={4} fill="#9fdce8" className={on ? "ai-office-screen" : undefined} />
      <rect x={3} y={6} width={2} height={1} fill="#39404f" />
      <rect x={2} y={7} width={4} height={1} fill="#39404f" />
    </g>
  );
}

function Chair({ x, y, fill = "#c7a06a" }: { x: number; y: number; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={20} height={6} fill="#6b4a2f" />
      <rect x={x} y={y + 6} width={20} height={14} fill={fill} />
      <rect x={x + 2} y={y + 20} width={4} height={6} fill="#6b4a2f" />
      <rect x={x + 14} y={y + 20} width={4} height={6} fill="#6b4a2f" />
    </g>
  );
}

const PLANT_ROWS = ["..GG..", ".GGGG.", "GGGGGG", ".GGGG.", "..GG..", "..TT..", ".PPPP.", ".PPPP."];
const PLANT_COLORS = { G: "#4f8a5b", T: "#7a5a40", P: "#c06a4a" };

function Plant({ x, y, s = 5 }: { x: number; y: number; s?: number }) {
  return <Px rows={PLANT_ROWS} colors={PLANT_COLORS} x={x} y={y} s={s} />;
}

const SHELF_ROWS = [
  "WWWWWWWWWW",
  "W11223344W",
  "W11223344W",
  "WWWWWWWWWW",
  "W55667711W",
  "W55667711W",
  "WWWWWWWWWW",
  "W33445566W",
  "W33445566W",
  "WWWWWWWWWW"
];
const SHELF_COLORS = {
  W: "#6b4a2f",
  "1": "#c76b98",
  "2": "#3f7cac",
  "3": "#e58f65",
  "4": "#5a9367",
  "5": "#d9a441",
  "6": "#7d6b91",
  "7": "#8d7b68"
};

function Shelf({ x, y, s = 7 }: { x: number; y: number; s?: number }) {
  return <Px rows={SHELF_ROWS} colors={SHELF_COLORS} x={x} y={y} s={s} />;
}

const SOFA_ROWS = ["B..........B", "BCCCCCCCCCCB", "BCCCCCCCCCCB", "BCCCCCCCCCCB", "BBBBBBBBBBBB", "B..B....B..B"];

function Sofa({ x, y, s = 6, color = "#7d8fb0" }: { x: number; y: number; s?: number; color?: string }) {
  return <Px rows={SOFA_ROWS} colors={{ B: "#6b4a2f", C: color }} x={x} y={y} s={s} />;
}

const CAT_ROWS = [".M.M.....", ".MMMM....", ".MWMW....", ".MMMMMM.M", ".MMMMMMMM", ".MMMMMM..", ".M.M.M..."];

function Cat({ x, y, s = 5 }: { x: number; y: number; s?: number }) {
  return <Px rows={CAT_ROWS} colors={{ M: "#55505e", W: "#f5d76e" }} x={x} y={y} s={s} />;
}

const BIRD_ROWS = ["..BBB..", ".BBBBB.", ".BWBBO.", ".BBBBB.", "..BBB..", "..L.L.."];

function Bird({ x, y, s = 4 }: { x: number; y: number; s?: number }) {
  return (
    <Px
      rows={BIRD_ROWS}
      colors={{ B: "#e8b64c", W: "#2b2b33", O: "#e07a3f", L: "#b5772f" }}
      x={x}
      y={y}
      s={s}
      className="ai-office-hop"
    />
  );
}

const COFFEE_ROWS = ["MMMMMMMM", "MLLMMLLM", "MMMMMMMM", "M......M", "M..CC..M", "M..CC..M", "MMMMMMMM", "MMMMMMMM"];

function CoffeeMachine({ x, y, s = 6 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <Px rows={COFFEE_ROWS} colors={{ M: "#5a4638", L: "#e58f65", C: "#f5efe4" }} x={x} y={y} s={s} />
      {/* 湯気 */}
      <rect x={x + 18} y={y - 14} width={5} height={10} fill="#ffffff" opacity={0.8} className="ai-office-steam" />
      <rect x={x + 28} y={y - 10} width={5} height={10} fill="#ffffff" opacity={0.8} className="ai-office-steam" style={{ animationDelay: "0.9s" }} />
    </g>
  );
}

const PAPER_ROWS = [".LLLL.", "WWWWWW", "W----W", "WWWWWW", "W----W", "WWWWWW"];

function PaperStack({ x, y, s = 4 }: { x: number; y: number; s?: number }) {
  return <Px rows={PAPER_ROWS} colors={{ W: "#fbf6ec", L: "#d8dcea", "-": "#c9b896" }} x={x} y={y} s={s} />;
}

const TOOLBOX_ROWS = ["..HHH..", "RRRRRRR", "RRRRRRR", "RRRRRRR"];

function Toolbox({ x, y, s = 5 }: { x: number; y: number; s?: number }) {
  return <Px rows={TOOLBOX_ROWS} colors={{ H: "#4a3728", R: "#c0503a" }} x={x} y={y} s={s} />;
}

const FLOWER_ROWS = [".F.Y.F.Y.F..", "GGGGGGGGGGGG", "PPPPPPPPPPPP", "PPPPPPPPPPPP"];

function FlowerBed({ x, y, s = 5 }: { x: number; y: number; s?: number }) {
  return (
    <Px rows={FLOWER_ROWS} colors={{ F: "#e07a9a", Y: "#e8c04c", G: "#5a9367", P: "#8d6440" }} x={x} y={y} s={s} />
  );
}

const BENCH_ROWS = ["WWWWWWWWWWWW", "WWWWWWWWWWWW", "..W......W..", "..W......W.."];

function Bench({ x, y, s = 5 }: { x: number; y: number; s?: number }) {
  return <Px rows={BENCH_ROWS} colors={{ W: "#7a5a40" }} x={x} y={y} s={s} />;
}

function WallBoard({
  x,
  y,
  w,
  h,
  marks
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  marks?: Array<{ dx: number; dy: number; w: number; h: number; fill: string }>;
}) {
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} fill="#8a97a8" />
      <rect x={x} y={y} width={w} height={h} fill="#fbfbf7" />
      {(marks ?? []).map((m, i) => (
        <rect key={i} x={x + m.dx} y={y + m.dy} width={m.w} height={m.h} fill={m.fill} />
      ))}
    </g>
  );
}

// ---- ドアの開口部 ----

function Door({ x, y, horizontal = true }: { x: number; y: number; horizontal?: boolean }) {
  // 壁帯（8px）の上に廊下床色を重ねて「開口部」に見せる
  if (horizontal) {
    return (
      <g>
        <rect x={x} y={y - 1} width={56} height={10} fill="#ead9bd" />
        <rect x={x - 4} y={y - 3} width={4} height={14} fill={DOOR_FRAME} />
        <rect x={x + 56} y={y - 3} width={4} height={14} fill={DOOR_FRAME} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x - 1} y={y} width={10} height={56} fill="#ead9bd" />
      <rect x={x - 3} y={y - 4} width={14} height={4} fill={DOOR_FRAME} />
      <rect x={x - 3} y={y + 56} width={14} height={4} fill={DOOR_FRAME} />
    </g>
  );
}

// ---- 建物本体 ----

export function BuildingSvg({ activeRooms }: { activeRooms: Set<RoomId> }) {
  const r = roomRects;
  const on = (id: RoomId) => activeRooms.has(id);

  return (
    <svg
      viewBox={`0 0 ${FLOOR_W} ${FLOOR_H}`}
      width="100%"
      shapeRendering="crispEdges"
      style={{ display: "block" }}
      role="img"
      aria-label="mikke AI OFFICE のオフィスフロア"
    >
      <defs>
        <pattern id="aiofc-wood" width="56" height="14" patternUnits="userSpaceOnUse">
          <rect width="56" height="14" fill="#caa26c" />
          <rect width="56" height="1" fill="#b58c58" />
          <rect y="7" width="56" height="1" fill="#c1975f" />
          <rect x="27" width="1" height="7" fill="#b58c58" />
          <rect x="55" y="7" width="1" height="7" fill="#b58c58" />
        </pattern>
        <pattern id="aiofc-hall" width="36" height="36" patternUnits="userSpaceOnUse">
          <rect width="36" height="36" fill="#ead9bd" />
          <rect width="36" height="1" fill="#dcc9a8" />
          <rect width="1" height="36" fill="#dcc9a8" />
        </pattern>
        <pattern id="aiofc-grass" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#a8cf8e" />
          <rect x="4" y="6" width="2" height="2" fill="#8fbc74" />
          <rect x="16" y="14" width="2" height="2" fill="#8fbc74" />
          <rect x="10" y="20" width="2" height="2" fill="#98c47e" />
        </pattern>
      </defs>

      {/* ==== テラスの地面（建物の外） ==== */}
      <rect x={0} y={660} width={FLOOR_W} height={FLOOR_H - 660} fill="url(#aiofc-grass)" />

      {/* ==== 建物の躯体（壁）と屋根 ==== */}
      <rect x={0} y={0} width={FLOOR_W} height={660} fill={WALL} />
      <rect x={0} y={0} width={FLOOR_W} height={20} fill={ROOF} />
      <rect x={0} y={20} width={FLOOR_W} height={6} fill={ROOF_TRIM} />

      {/* ==== 部屋の床＋奥壁 ==== */}
      {(Object.keys(r) as RoomId[])
        .filter((id) => id !== "terrace")
        .map((id) => {
          const rect = r[id];
          return (
            <g key={id}>
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="url(#aiofc-wood)" />
              <rect x={rect.x} y={rect.y} width={rect.w} height={26} fill={backWallColor[id] ?? "#f0e7d8"} />
              <rect x={rect.x} y={rect.y + 26} width={rect.w} height={3} fill="#00000020" />
              {id === "coding" && (
                <rect x={rect.x} y={rect.y + 26} width={rect.w} height={rect.h - 26} fill="#1e2a4a" opacity={0.1} />
              )}
            </g>
          );
        })}

      {/* ==== 廊下・縦通路 ==== */}
      <rect x={corridorRect.x} y={corridorRect.y} width={corridorRect.w} height={corridorRect.h} fill="url(#aiofc-hall)" />
      <rect x={corridorRect.x} y={corridorRect.y} width={corridorRect.w} height={3} fill="#00000018" />
      <rect x={passageRect.x} y={passageRect.y} width={passageRect.w} height={passageRect.h} fill="url(#aiofc-hall)" />

      {/* ==== ドア（各部屋 → 廊下） ==== */}
      <Door x={r.reception.x + r.reception.w / 2 - 28} y={292} />
      <Door x={r.advisor.x + r.advisor.w / 2 - 28} y={292} />
      <Door x={r.course.x + r.course.w / 2 - 28} y={292} />
      <Door x={r.editing.x + r.editing.w / 2 - 28} y={292} />
      <Door x={r.design.x + r.design.w / 2 - 28} y={371} />
      <Door x={r.coding.x + r.coding.w / 2 - 28} y={371} />
      <Door x={r.meeting.x + r.meeting.w / 2 - 28} y={371} />
      <Door x={r.break.x + r.break.w / 2 - 28} y={371} />

      {/* ==== エントランス（左端・廊下へ） ==== */}
      <rect x={0} y={310} width={10} height={52} fill="url(#aiofc-hall)" />
      <rect x={0} y={306} width={4} height={4} fill={DOOR_FRAME} />
      <rect x={0} y={362} width={4} height={4} fill={DOOR_FRAME} />
      {/* 玄関マット */}
      <rect x={16} y={316} width={52} height={40} fill="#dd8f66" />
      <rect x={20} y={320} width={44} height={32} fill="none" stroke="#c67347" strokeWidth={3} />
      <Plant x={78} y={306} s={5} />

      {/* ==== テラスへの出口（縦通路の下端） ==== */}
      <rect x={1248} y={648} width={34} height={12} fill="url(#aiofc-hall)" />
      <rect x={1244} y={660} width={42} height={10} fill="#d9c8a6" />
      <rect x={1248} y={670} width={34} height={8} fill="#cbb894" />

      {/* ==================== 家具 ==================== */}

      {/* 受付・社長室：受付カウンター / 電話 / 書類 / 額縁 / 大きめデスク / 観葉植物 */}
      <g>
        <Rug x={200} y={130} w={150} h={72} fill="#f2e6c8" />
        {/* 額縁 */}
        <rect x={56} y={30} width={40} height={22} fill="#b08d3e" />
        <rect x={60} y={34} width={32} height={14} fill="#e9f0f6" />
        <rect x={66} y={40} width={12} height={4} fill="#3f7cac" />
        {/* 社長デスク */}
        <Desk x={230} y={110} w={110} />
        <Monitor x={262} y={82} s={5} on={on("reception")} />
        <Chair x={276} y={158} fill="#c9b07a" />
        {/* 受付カウンター（エントランス近く） */}
        <rect x={60} y={200} width={130} height={10} fill="#d9ab77" />
        <rect x={60} y={210} width={130} height={30} fill="#aa7850" />
        <rect x={60} y={210} width={130} height={4} fill="#8d6440" />
        {/* 電話 */}
        <rect x={76} y={190} width={18} height={10} fill="#39404f" />
        <rect x={80} y={186} width={10} height={4} fill="#39404f" />
        {/* 受付ベル（金色） */}
        <rect x={112} y={192} width={10} height={4} fill="#d9a441" />
        <rect x={115} y={188} width={4} height={4} fill="#e8c04c" />
        <PaperStack x={140} y={178} s={4} />
        <PaperStack x={166} y={184} s={4} />
        {/* 案内マット（カウンター前） */}
        <rect x={80} y={252} width={90} height={26} fill="#f2e6c8" opacity={0.9} />
        <Plant x={430} y={100} s={6} />
        <Plant x={20} y={90} s={5} />
      </g>

      {/* 顧問室：ソファ / 丸テーブル / ティーカップ / 本棚 / 猫 / 紫ラグ */}
      <g>
        <Rug x={540} y={150} w={160} h={84} fill="#e4dcf2" />
        <Sofa x={516} y={96} s={6} color="#9c8ab8" />
        {/* 丸テーブル＋ティーカップ */}
        <rect x={620} y={176} width={56} height={8} fill="#d9ab77" />
        <rect x={624} y={184} width={48} height={20} fill="#aa7850" />
        <rect x={636} y={166} width={10} height={8} fill="#f5efe4" />
        <rect x={646} y={168} width={3} height={4} fill="#f5efe4" />
        {/* ティーポット */}
        <rect x={654} y={164} width={12} height={10} fill="#9c8ab8" />
        <rect x={666} y={166} width={4} height={4} fill="#9c8ab8" />
        <rect x={658} y={160} width={4} height={4} fill="#7d6b91" />
        {/* ソファのクッション */}
        <rect x={530} y={106} width={14} height={12} fill="#e4dcf2" />
        <rect x={560} y={106} width={14} height={12} fill="#d9a441" />
        {/* 壁の小さな絵 */}
        <rect x={540} y={32} width={26} height={18} fill="#b08d3e" />
        <rect x={544} y={36} width={18} height={10} fill="#e4dcf2" />
        <Shelf x={700} y={40} s={6} />
        <Cat x={724} y={238} s={5} />
      </g>

      {/* 講座制作室：ホワイトボード / 共同制作机 / 教材ノート / 付箋 / 撮影ライト / モニター */}
      <g>
        <WallBoard
          x={840}
          y={32}
          w={130}
          h={20}
          marks={[
            { dx: 8, dy: 5, w: 46, h: 3, fill: "#3f7cac" },
            { dx: 8, dy: 11, w: 66, h: 3, fill: "#c76b98" },
            { dx: 92, dy: 4, w: 10, h: 10, fill: "#e58f65" }
          ]}
        />
        {/* 付箋 */}
        <rect x={1120} y={34} width={12} height={12} fill="#f5d76e" />
        <rect x={1138} y={38} width={12} height={12} fill="#e07a9a" />
        <rect x={1124} y={52} width={12} height={12} fill="#8fd0a0" />
        {/* 共同制作机 */}
        <Desk x={880} y={130} w={180} />
        <rect x={904} y={122} width={26} height={8} fill="#3f7cac" />
        <rect x={992} y={122} width={26} height={8} fill="#e58f65" />
        <Monitor x={1130} y={110} s={5} on={on("course")} />
        {/* 撮影ライト */}
        <rect x={816} y={130} width={4} height={70} fill="#39404f" />
        <rect x={808} y={118} width={20} height={14} fill="#f5efe4" />
        <rect x={806} y={196} width={24} height={6} fill="#39404f" />
        {/* 撮影カメラ（三脚） */}
        <rect x={844} y={216} width={22} height={14} fill="#39404f" />
        <rect x={866} y={220} width={6} height={6} fill="#2b3140" />
        <rect x={848} y={230} width={3} height={16} fill="#5b6270" />
        <rect x={858} y={230} width={3} height={16} fill="#5b6270" />
        {/* 教材ノートの山 */}
        <rect x={1060} y={224} width={30} height={6} fill="#3f7cac" />
        <rect x={1064} y={218} width={30} height={6} fill="#e58f65" />
        <rect x={1060} y={212} width={30} height={6} fill="#5a9367" />
        <PaperStack x={936} y={116} s={3} />
      </g>

      {/* 編集室：大きな本棚 / 原稿の山 / 赤ペン / PC / ピンクラグ */}
      <g>
        <Rug x={1290} y={160} w={170} h={84} fill="#f6dbe4" />
        <Shelf x={1260} y={36} s={7} />
        <Desk x={1400} y={118} w={110} />
        <Monitor x={1434} y={90} s={5} on={on("editing")} />
        <PaperStack x={1350} y={222} s={4} />
        <PaperStack x={1386} y={236} s={4} />
        <PaperStack x={1322} y={240} s={4} />
        {/* 赤ペン */}
        <rect x={1418} y={112} width={16} height={4} fill="#c93f2d" />
        {/* 校正紙（赤入れの跡） */}
        <rect x={1524} y={200} width={40} height={30} fill="#fbf6ec" />
        <rect x={1530} y={206} width={26} height={3} fill="#c9b896" />
        <rect x={1530} y={213} width={20} height={3} fill="#c93f2d" />
        <rect x={1530} y={220} width={28} height={3} fill="#c9b896" />
        {/* 原稿の束（紐かけ） */}
        <rect x={1460} y={236} width={36} height={18} fill="#f0e6d2" />
        <rect x={1474} y={236} width={4} height={18} fill="#a9744f" />
      </g>

      {/* デザイン室：液タブ / カラーチャート / ポスター / モニター / 観葉植物 / コーラルラグ */}
      <g>
        <Rug x={90} y={548} w={170} h={70} fill="#f8ddd0" />
        {/* ポスター */}
        <rect x={50} y={386} width={30} height={22} fill="#e58f65" />
        <rect x={56} y={392} width={18} height={4} fill="#ffffff" />
        <rect x={94} y={388} width={26} height={20} fill="#3f7cac" />
        {/* カラーチャート */}
        {["#e58f65", "#3f7cac", "#c76b98", "#5a9367", "#d9a441", "#7d6b91", "#c93f2d", "#8d7b68"].map((c, i) => (
          <rect key={c} x={150 + (i % 4) * 14} y={388 + Math.floor(i / 4) * 14} width={11} height={11} fill={c} />
        ))}
        <Desk x={110} y={480} w={110} />
        {/* 液タブ */}
        <rect x={132} y={472} width={40} height={10} fill="#5b6270" />
        <rect x={136} y={474} width={32} height={6} fill="#c8cede" />
        <Monitor x={250} y={470} s={5} on={on("design")} />
        <Plant x={330} y={452} s={6} />
        {/* 画像パネル（ムードボード） */}
        {["#e58f65", "#9fdce8", "#c76b98", "#5a9367", "#d9a441", "#7d6b91"].map((c, i) => (
          <rect key={c} x={236 + (i % 3) * 18} y={388 + Math.floor(i / 3) * 16} width={15} height={13} fill={c} opacity={0.85} />
        ))}
        {/* 絵の具・ペン立て */}
        <rect x={228} y={472} width={4} height={8} fill="#c93f2d" />
        <rect x={233} y={470} width={4} height={10} fill="#3f7cac" />
        <rect x={238} y={473} width={4} height={7} fill="#5a9367" />
        {/* 丸めたポスター */}
        <rect x={40} y={600} width={8} height={34} fill="#f0e6d2" />
        <rect x={52} y={606} width={8} height={28} fill="#f6dbe4" />
      </g>

      {/* 実装室：複数モニター / サーバーラック / 工具箱（床は少し暗め） */}
      <g>
        <Desk x={430} y={490} w={110} />
        <Monitor x={442} y={462} s={5} on={on("coding")} />
        <Monitor x={488} y={462} s={5} on={on("coding")} />
        <Desk x={580} y={480} w={110} />
        <Monitor x={592} y={452} s={5} on={on("coding")} />
        <Monitor x={638} y={452} s={5} on={on("coding")} />
        {/* サーバーラック */}
        <rect x={700} y={396} width={44} height={96} fill="#39404f" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={704} y={402 + i * 22} width={36} height={14} fill="#2b3140" />
            <rect x={708} y={406 + i * 22} width={4} height={4} fill="#7fe08a" className="px-glow" />
            <rect x={716} y={406 + i * 22} width={4} height={4} fill="#e58f65" />
          </g>
        ))}
        <Toolbox x={410} y={600} s={5} />
        {/* コード画面（壁のダッシュボード） */}
        <rect x={470} y={386} width={70} height={30} fill="#2b3140" />
        <rect x={476} y={392} width={34} height={3} fill="#7fe08a" />
        <rect x={476} y={398} width={48} height={3} fill="#9fdce8" />
        <rect x={476} y={404} width={26} height={3} fill="#e58f65" />
        {/* ケーブル（床を這う） */}
        <rect x={540} y={520} width={150} height={3} fill="#39404f" opacity={0.7} />
        <rect x={688} y={492} width={3} height={30} fill="#39404f" opacity={0.7} />
        {/* 予備の機材箱 */}
        <rect x={660} y={606} width={34} height={22} fill="#5b6270" />
        <rect x={664} y={610} width={26} height={4} fill="#39404f" />
      </g>

      {/* 会議室：大テーブル / 椅子 / プロジェクター / 進捗ボード / 飲み物 */}
      <g>
        <Rug x={820} y={470} w={300} h={130} fill="#e2f0dc" />
        {/* プロジェクタースクリーン */}
        <WallBoard x={830} y={32 + 352} w={140} h={22} marks={[{ dx: 10, dy: 6, w: 60, h: 10, fill: "#dfe8f2" }]} />
        {/* 進捗ボード（ミニカンバン） */}
        <WallBoard
          x={1030}
          y={386}
          w={90}
          h={26}
          marks={[
            { dx: 6, dy: 5, w: 10, h: 8, fill: "#4d7cf2" },
            { dx: 22, dy: 5, w: 10, h: 8, fill: "#e58f65" },
            { dx: 38, dy: 5, w: 10, h: 8, fill: "#d9a441" },
            { dx: 54, dy: 5, w: 10, h: 8, fill: "#4caf6e" }
          ]}
        />
        {/* 大きな会議テーブル */}
        <rect x={860} y={500} width={220} height={12} fill="#d9ab77" />
        <rect x={860} y={512} width={220} height={44} fill="#aa7850" />
        <rect x={860} y={512} width={220} height={4} fill="#8d6440" />
        {/* 飲み物 */}
        <rect x={906} y={492} width={10} height={8} fill="#f5efe4" />
        <rect x={1010} y={492} width={10} height={8} fill="#9fdce8" />
        <Chair x={880} y={462} />
        <Chair x={960} y={462} />
        <Chair x={1040} y={462} />
        <Chair x={900} y={566} />
        <Chair x={1020} y={566} />
        {/* 会議資料 */}
        <rect x={950} y={520} width={26} height={16} fill="#fbf6ec" />
        <rect x={954} y={524} width={18} height={2} fill="#c9b896" />
        <rect x={954} y={529} width={14} height={2} fill="#c9b896" />
        {/* 議題メモ（付箋） */}
        <rect x={1140} y={392} width={11} height={11} fill="#f5d76e" />
        <rect x={1156} y={396} width={11} height={11} fill="#8fd0a0" />
      </g>

      {/* 休憩室：コーヒーマシン（湯気） / 冷蔵庫 / ソファ / お菓子 / 小テーブル / ミントラグ */}
      <g>
        <Rug x={1350} y={540} w={170} h={76} fill="#dcf2e8" />
        <CoffeeMachine x={1320} y={412} s={6} />
        {/* 冷蔵庫 */}
        <rect x={1534} y={396} width={38} height={78} fill="#e8ecf2" />
        <rect x={1534} y={396} width={38} height={3} fill="#c4ccd8" />
        <rect x={1534} y={426} width={38} height={3} fill="#c4ccd8" />
        <rect x={1566} y={404} width={3} height={14} fill="#9aa3b2" />
        <Sofa x={1400} y={548} s={6} color="#7fb8a0" />
        {/* 小テーブル＋お菓子 */}
        <rect x={1428} y={508} width={48} height={8} fill="#d9ab77" />
        <rect x={1432} y={516} width={40} height={16} fill="#aa7850" />
        <rect x={1438} y={500} width={10} height={8} fill="#e07a9a" />
        <rect x={1454} y={500} width={10} height={8} fill="#f5d76e" />
        {/* 雑誌ラック */}
        <rect x={1310} y={556} width={30} height={36} fill="#6b4a2f" />
        <rect x={1314} y={560} width={9} height={22} fill="#c76b98" />
        <rect x={1326} y={560} width={9} height={22} fill="#3f7cac" />
        {/* お菓子のかご */}
        <rect x={1490} y={516} width={26} height={12} fill="#a9744f" />
        <rect x={1494} y={510} width={7} height={6} fill="#e58f65" />
        <rect x={1504} y={510} width={7} height={6} fill="#8fd0a0" />
      </g>

      {/* ==== みっけテラス：花壇 / ベンチ / 小テーブル / 植木 / 鳥 ==== */}
      <g>
        <FlowerBed x={110} y={700} s={5} />
        <FlowerBed x={1380} y={706} s={5} />
        <Bench x={560} y={712} s={5} />
        <Bench x={950} y={716} s={5} />
        {/* 小さなテーブル */}
        <rect x={780} y={716} width={44} height={8} fill="#d9ab77" />
        <rect x={786} y={724} width={32} height={18} fill="#aa7850" />
        {/* 植木 */}
        <Plant x={60} y={676} s={7} />
        <Plant x={1500} y={680} s={7} />
        <Bird x={1220} y={738} s={4} />
        {/* 下段（奥行きが増えた分）：飛び石・眠る猫・花壇 */}
        <rect x={300} y={784} width={26} height={12} fill="#d9c8a6" />
        <rect x={360} y={792} width={26} height={12} fill="#d9c8a6" />
        <rect x={420} y={786} width={26} height={12} fill="#d9c8a6" />
        <Px
          rows={[".M.M......", "MMMMMMMM..", "MMMMMMMMMM", ".MMMMMMMM."]}
          colors={{ M: "#b58a55" }}
          x={700}
          y={780}
          s={4}
        />
        <FlowerBed x={1050} y={780} s={4} />
        <Plant x={200} y={768} s={5} />
      </g>
    </svg>
  );
}
