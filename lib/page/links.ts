import type { PageBlock, PageDocument, PageSite } from "./types";

export type PageLinkIssueType = "empty" | "dummy" | "missing-page" | "invalid-external";

export const pageLinkIssueLabels: Record<PageLinkIssueType, string> = {
  empty: "空リンク",
  dummy: "#のみのダミーリンク",
  "missing-page": "存在しないページ",
  "invalid-external": "http(s)形式でない外部URL"
};

export type PageLinkIssue = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentSlug: string;
  blockId: string;
  blockLabel: string;
  fieldLabel: string;
  value: string;
  issue: PageLinkIssueType;
};

const blockTypeLabels: Partial<Record<PageBlock["type"], string>> = {
  heading: "見出し",
  text: "文章",
  image: "画像",
  button: "ボタン",
  form: "フォーム",
  divider: "区切り",
  cms: "mikke CMS",
  company: "会社概要",
  columns: "カラム",
  gallery: "画像グリッド",
  slideshow: "スライド",
  embed: "外部埋め込み",
  html: "HTML"
};

function looksLikeUrlAttempt(value: string) {
  // scheme://... 形式、または example.com のようなドメインらしき文字列
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[\w-]+(\.[a-z]{2,})+(\/.*)?$/i.test(value);
}

/**
 * リンク値を4分類のいずれかに判定する（問題なければnull）。fetchは行わず、文字列とサイト内slugの整合のみ見る。
 */
export function classifyPageLinkValue(rawValue: string, siteSlugs: string[]): PageLinkIssueType | null {
  const value = rawValue.trim();
  if (!value) return "empty";
  if (/^#+$/.test(value)) return "dummy";
  if (value.startsWith("#")) return null; // ページ内アンカー
  if (/^https?:\/\//i.test(value)) return null; // 正しい外部URL
  if (/^(mailto:|tel:)/i.test(value)) return null; // 直接アクション用リンク
  if (looksLikeUrlAttempt(value)) return "invalid-external";
  const normalized = value.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (siteSlugs.includes(normalized)) return null; // サイト内ページslugと一致
  return "missing-page";
}

type LinkField = { blockId: string; blockLabel: string; fieldLabel: string; value: string };

function collectDocumentLinkFields(document: PageDocument): LinkField[] {
  if (document.mode !== "builder") return [];
  const fields: LinkField[] = [];
  for (const block of document.blocks) {
    const blockLabel = blockTypeLabels[block.type] ?? "ブロック";
    if (block.type === "button") {
      fields.push({ blockId: block.id, blockLabel, fieldLabel: "ボタンのリンク先", value: block.href });
    }
    if (block.type === "columns") {
      for (const column of block.columns) {
        if (!column.buttonLabel) continue;
        fields.push({ blockId: block.id, blockLabel, fieldLabel: `カラム「${column.title || "無題"}」のリンク先`, value: column.href ?? "" });
      }
    }
    if (block.type === "embed" && block.url) {
      fields.push({ blockId: block.id, blockLabel, fieldLabel: "外部埋め込みURL", value: block.url });
    }
  }
  return fields;
}

/** サイト内の全ページ・全ブロックのリンクを走査し、問題があるものだけを一覧化する */
export function collectSiteLinkIssues(site: PageSite): PageLinkIssue[] {
  const siteSlugs = site.documents.map((document) => document.slug.toLowerCase());
  const issues: PageLinkIssue[] = [];
  for (const document of site.documents) {
    for (const field of collectDocumentLinkFields(document)) {
      const issue = classifyPageLinkValue(field.value, siteSlugs);
      if (!issue) continue;
      issues.push({
        id: `${document.id}_${field.blockId}_${field.fieldLabel}`,
        documentId: document.id,
        documentTitle: document.title,
        documentSlug: document.slug,
        blockId: field.blockId,
        blockLabel: field.blockLabel,
        fieldLabel: field.fieldLabel,
        value: field.value,
        issue
      });
    }
  }
  return issues;
}
