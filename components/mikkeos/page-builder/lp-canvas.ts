import type { LpBlock } from "./lp-design";
export function findLpBlock(blocks: LpBlock[], id: string): LpBlock | undefined {
  for (const block of blocks) { if (block.id === id) return block; const child = findLpBlock(block.lp?.children ?? [], id); if (child) return child; }
}
export function updateLpBlock(blocks: LpBlock[], id: string, update: (b: LpBlock) => LpBlock): LpBlock[] {
  return blocks.map(b => b.id === id ? update(b) : b.lp?.children ? { ...b, lp: { ...b.lp, children: updateLpBlock(b.lp.children, id, update) } } : b);
}
export function operateLpBlock(blocks: LpBlock[], id: string, action: "up" | "down" | "delete" | "copy"): LpBlock[] {
  const index = blocks.findIndex(b => b.id === id);
  if (index < 0) return blocks.map(b => b.lp?.children ? { ...b, lp: { ...b.lp, children: operateLpBlock(b.lp.children, id, action) } } : b);
  const next = [...blocks];
  if (action === "delete") next.splice(index, 1);
  else if (action === "copy") next.splice(index + 1, 0, cloneLpBlock(blocks[index]));
  else { const to = index + (action === "up" ? -1 : 1); if (to >= 0 && to < next.length) [next[index], next[to]] = [next[to], next[index]]; }
  return next;
}
export function cloneLpBlock(block: LpBlock): LpBlock {
  const copy = structuredClone(block); copy.id = crypto.randomUUID();
  if (copy.lp?.children) copy.lp.children = copy.lp.children.map(cloneLpBlock);
  return copy;
}
export function newFaqItem(): LpBlock {
  return { id: crypto.randomUUID(), type: "paragraph", title: "質問と回答", text: "", lp: {
    desktop: { padding: 16, background: "#ffffff", radius: 8 },
    children: [
      { id: crypto.randomUUID(), type: "heading", level: 3, text: "質問を入力してください" },
      { id: crypto.randomUUID(), type: "paragraph", text: "回答を入力してください。" },
    ],
  } };
}
export const sectionChoices = ["メイン", "画像＋文章", "特徴", "よくある質問", "空のBOX"] as const;
export function sectionTemplate(kind: typeof sectionChoices[number]): LpBlock {
  const make = (type: LpBlock["type"], text: string): LpBlock => ({ id: crypto.randomUUID(), type, text, ...(type === "heading" ? { level: 2 as const } : {}) });
  const title = make("heading", kind === "メイン" ? "サービスの魅力をひとことで" : kind);
  title.lp = { desktop: { size: kind === "メイン" ? 36 : 26, lineHeight: 1.4 }, mobile: { size: 24 } };
  let children: LpBlock[] = [title, make("paragraph", "伝えたい内容を入力してください。")];
  if (kind === "画像＋文章") children = [{ ...make("image-text", "内容を紹介してください。"), title: "できること", imageSide: "left" }];
  if (kind === "特徴") children = [1, 2, 3].map(n => ({ ...make("paragraph", ""), lp: { desktop: { background: "#ffffff", padding: 20, radius: 12 }, children: [make("heading", `特徴 ${n}`), make("paragraph", "内容を入力してください。")] } }));
  if (kind === "よくある質問") children = [make("heading", "よくある質問"), newFaqItem(), newFaqItem()];
  if (kind === "空のBOX") children = [];
  return { ...make("paragraph", ""), title: kind, lp: { ...(kind === "よくある質問" ? { template: "faq" as const } : {}), desktop: { padding: 28, gap: 16, background: "#f7f7f5", radius: 0, columns: kind === "特徴" ? 3 : 1 }, mobile: { padding: 18, columns: 1 }, children } };
}
