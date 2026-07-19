import type {
  PageBlock,
  PageBlockStyle,
  PageFontPreset,
  PageHtmlDocument,
  PageSiteTheme
} from "./types";

export type PageStarterTemplateId = "blank" | "company" | "service" | "portfolio" | "connect-partners";
export type PageSectionTemplateId = "hero" | "image-text" | "company" | "features" | "cta" | "cms";

export const defaultPageHtmlDocument: PageHtmlDocument = {
  html: `<main class="hero"><p class="eyebrow">YOUR BRAND</p><h1>ここに、あなたらしいページを。</h1><p>AIが作成したHTMLを貼り付けて、自由なブランドページを作れます。</p><a href="#contact">詳しく見る</a></main>`,
  css: `*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:#17203a;background:#fffaf7}.hero{min-height:100vh;display:grid;place-content:center;gap:18px;padding:48px;text-align:center}.eyebrow{color:#ed6b3a;font-weight:800;letter-spacing:.18em}h1{margin:0;font-size:clamp(2rem,6vw,5rem);line-height:1.05}p{margin:0;line-height:1.8}a{justify-self:center;margin-top:12px;padding:14px 24px;border-radius:999px;background:#17203a;color:white;text-decoration:none;font-weight:700}`,
  javascript: "",
  allowScripts: false,
  showSiteChrome: false
};

export const pageThemePresets: Record<PageFontPreset, PageSiteTheme> = {
  gothic: {
    presetId: "gothic",
    primaryColor: "#1f2a7a",
    accentColor: "#ed6b3a",
    backgroundColor: "#ffffff",
    textColor: "#17203a",
    headingFont: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
    bodyFont: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
    headingJpFontId: "noto-sans",
    headingLatinFontId: "none",
    bodyJpFontId: "noto-sans",
    bodyLatinFontId: "none",
    contentWidth: "standard",
    buttonStyle: "rounded"
  },
  soft: {
    presetId: "soft",
    primaryColor: "#9b5f4a",
    accentColor: "#df8c68",
    backgroundColor: "#fffaf7",
    textColor: "#443b37",
    headingFont: '"Zen Kaku Gothic New", "Noto Sans JP", sans-serif',
    bodyFont: '"Noto Sans JP", sans-serif',
    headingJpFontId: "zen-kaku",
    headingLatinFontId: "none",
    bodyJpFontId: "noto-sans",
    bodyLatinFontId: "none",
    contentWidth: "standard",
    buttonStyle: "pill"
  },
  serif: {
    presetId: "serif",
    primaryColor: "#33463b",
    accentColor: "#9b7b4f",
    backgroundColor: "#fbfaf6",
    textColor: "#282d29",
    headingFont: '"Noto Serif JP", "Yu Mincho", serif',
    bodyFont: '"Noto Sans JP", sans-serif',
    headingJpFontId: "noto-serif",
    headingLatinFontId: "none",
    bodyJpFontId: "noto-sans",
    bodyLatinFontId: "none",
    contentWidth: "narrow",
    buttonStyle: "square"
  },
  modern: {
    presetId: "modern",
    primaryColor: "#111827",
    accentColor: "#7c3aed",
    backgroundColor: "#f8fafc",
    textColor: "#111827",
    headingFont: 'Inter, "Noto Sans JP", sans-serif',
    bodyFont: 'Inter, "Noto Sans JP", sans-serif',
    headingJpFontId: "noto-sans",
    headingLatinFontId: "inter",
    bodyJpFontId: "noto-sans",
    bodyLatinFontId: "inter",
    contentWidth: "wide",
    buttonStyle: "rounded"
  }
};

export const defaultPageTheme = pageThemePresets.gothic;

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function style(overrides: PageBlockStyle = {}): PageBlockStyle {
  return { spacing: "normal", radius: "medium", animation: "none", textAlign: "left", ...overrides };
}

export function clonePageTheme(theme: PageSiteTheme = defaultPageTheme): PageSiteTheme {
  return { ...theme };
}

export function createSectionTemplate(templateId: PageSectionTemplateId, startOrder = 1): PageBlock[] {
  if (templateId === "hero") {
    return [
      { id: id("page_heading"), type: "heading", order: startOrder, level: 1, text: "想いが伝わるホームページ", style: style({ textAlign: "center", spacing: "spacious", animation: "fade-up" }) },
      { id: id("page_text"), type: "text", order: startOrder + 1, text: "活動やサービスを、あなたらしい言葉と写真で届けます。", size: "large", style: style({ textAlign: "center" }) },
      { id: id("page_button"), type: "button", order: startOrder + 2, label: "詳しく見る", href: "#about", variant: "solid", style: style({ textAlign: "center" }) }
    ];
  }

  if (templateId === "image-text") {
    return [{
      id: id("page_columns"),
      type: "columns",
      order: startOrder,
      title: "私たちについて",
      ratio: "1-1",
      columns: [
        { id: id("page_column"), title: "写真で伝える", text: "ファイルから写真を追加できます。", imageUrl: "", imageAlt: "" },
        { id: id("page_column"), eyebrow: "ABOUT", title: "大切にしていること", text: "活動の背景や、大事にしている価値観を書きます。", imageUrl: "", imageAlt: "", buttonLabel: "もっと知る", href: "#" }
      ],
      style: style({ spacing: "spacious", animation: "fade-up" })
    }];
  }

  if (templateId === "company") {
    return [{
      id: id("page_company"),
      type: "company",
      order: startOrder,
      title: "会社概要",
      rows: [
        { id: id("page_company_row"), label: "会社・団体名", value: "" },
        { id: id("page_company_row"), label: "代表者", value: "" },
        { id: id("page_company_row"), label: "所在地", value: "" },
        { id: id("page_company_row"), label: "設立", value: "" },
        { id: id("page_company_row"), label: "事業内容", value: "" }
      ],
      style: style({ spacing: "spacious" })
    }];
  }

  if (templateId === "features") {
    return [{
      id: id("page_columns"),
      type: "columns",
      order: startOrder,
      title: "選ばれる理由",
      ratio: "three",
      columns: [1, 2, 3].map((number) => ({
        id: id("page_column"),
        eyebrow: `POINT ${number}`,
        title: `特徴 ${number}`,
        text: "ここに特徴や強みを分かりやすく書きます。",
        imageUrl: "",
        imageAlt: ""
      })),
      style: style({ backgroundColor: "#f7f8fb", spacing: "spacious", radius: "large" })
    }];
  }

  if (templateId === "cta") {
    return [
      { id: id("page_heading"), type: "heading", order: startOrder, level: 2, text: "まずはお気軽にご相談ください", style: style({ textAlign: "center", backgroundColor: "#f7f8fb", spacing: "spacious", radius: "large" }) },
      { id: id("page_button"), type: "button", order: startOrder + 1, label: "お問い合わせ", href: "#contact", variant: "solid", style: style({ textAlign: "center" }) }
    ];
  }

  return [{
    id: id("page_cms"),
    type: "cms",
    order: startOrder,
    source: "story",
    displayMode: "cards",
    title: "最新の活動",
    filters: {},
    style: style({ spacing: "spacious" })
  }];
}

export function createStarterTemplate(templateId: PageStarterTemplateId): PageBlock[] {
  if (templateId === "blank") return [];
  if (templateId === "company") {
    return [
      ...createSectionTemplate("hero", 1),
      ...createSectionTemplate("image-text", 4),
      ...createSectionTemplate("company", 5),
      ...createSectionTemplate("cta", 6)
    ];
  }
  if (templateId === "service") {
    return [
      ...createSectionTemplate("hero", 1),
      ...createSectionTemplate("features", 4),
      ...createSectionTemplate("cms", 5),
      ...createSectionTemplate("cta", 6)
    ];
  }
  if (templateId === "portfolio") {
    return [
      ...createSectionTemplate("hero", 1),
      { id: id("page_gallery"), type: "gallery", order: 4, title: "ギャラリー", columns: 3, images: [], style: style({ spacing: "spacious" }) },
      ...createSectionTemplate("cms", 5)
    ];
  }
  return [
    { id: id("page_heading"), type: "heading", order: 1, level: 1, text: "Connect / Partners", style: style({ textAlign: "center", spacing: "spacious", animation: "fade-up" }) },
    { id: id("page_text"), type: "text", order: 2, text: "mikkeIDでつながる活動・商品・イベント・応援プロジェクトを紹介します。", size: "large", style: style({ textAlign: "center" }) },
    ...(["story", "item_studio", "event", "fund", "community"] as const).map((source, index) => ({
      id: id("page_cms"),
      type: "cms" as const,
      order: index + 3,
      source,
      displayMode: "cards" as const,
      title: source === "story" ? "つながる人" : source === "fund" ? "応援したい活動" : source === "community" ? "コミュニティ" : "活動を知る",
      filters: {},
      style: style({ spacing: "spacious" })
    }))
  ];
}
