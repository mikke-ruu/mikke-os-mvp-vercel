// mikke AI OFFICE — フロアSVGの座標系（viewBox）と部屋レイアウト定義。
// BuildingSvg（SVG描画）と OfficeFloor（HTMLオーバーレイ）で共有する。

import type { RoomId } from "@/lib/ai-office/types";

export const FLOOR_W = 1600;
export const FLOOR_H = 780;

export type FloorRect = { x: number; y: number; w: number; h: number };

/**
 * 各部屋の内側領域（壁を除いた床の範囲）。
 * 建物: y26〜648が室内、y300〜372が廊下、y668〜780がみっけテラス。
 * 均等グリッドにしない（受付・会議室を広く、顧問室・休憩室を小さめに）。
 */
export const roomRects: Record<RoomId, FloorRect> = {
  reception: { x: 10, y: 26, w: 470, h: 266 },
  advisor: { x: 490, y: 26, w: 290, h: 266 },
  course: { x: 790, y: 26, w: 430, h: 266 },
  editing: { x: 1230, y: 26, w: 360, h: 266 },
  design: { x: 10, y: 380, w: 370, h: 268 },
  coding: { x: 390, y: 380, w: 370, h: 268 },
  meeting: { x: 770, y: 380, w: 460, h: 268 },
  break: { x: 1300, y: 380, w: 290, h: 268 },
  terrace: { x: 0, y: 668, w: 1600, h: 112 }
};

/** 廊下（横方向）。左端がエントランス、右寄りの縦通路からテラスへ抜ける */
export const corridorRect: FloorRect = { x: 10, y: 300, w: 1580, h: 72 };

/** 会議室と休憩室の間の縦通路（テラスへの出口） */
export const passageRect: FloorRect = { x: 1240, y: 372, w: 50, h: 276 };

/** 社員が立つ位置（足元座標）。同室に複数いる場合は順番に使う */
export const roomSpots: Record<RoomId, Array<[number, number]>> = {
  reception: [
    [150, 262],
    [330, 250],
    [240, 272]
  ],
  advisor: [
    [590, 258],
    [700, 268]
  ],
  course: [
    [880, 258],
    [1070, 252],
    [975, 272]
  ],
  editing: [
    [1320, 258],
    [1490, 250]
  ],
  design: [
    [120, 616],
    [280, 604]
  ],
  coding: [
    [470, 618],
    [630, 606]
  ],
  meeting: [
    [850, 596],
    [990, 588],
    [1130, 598],
    [930, 622]
  ],
  break: [
    [1370, 618],
    [1500, 602]
  ],
  terrace: [
    [520, 762],
    [880, 756]
  ]
};

export const pctX = (x: number): string => `${((x / FLOOR_W) * 100).toFixed(3)}%`;
export const pctY = (y: number): string => `${((y / FLOOR_H) * 100).toFixed(3)}%`;
