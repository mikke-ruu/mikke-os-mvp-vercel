const allowedProtocols = new Set(["http:", "https:"]);
export const PAGE_HTML_MAX_BYTES = 500 * 1024;

export function analyzePageHtmlPayload(input: { html: string; css: string; javascript: string }) {
  const combined = `${input.html}\n${input.css}\n${input.javascript}`;
  return {
    bytes: new TextEncoder().encode(combined).byteLength,
    hasEmbeddedData: /data:(?:image|font|audio|video)\//i.test(combined)
  };
}

export function normalizePageEmbedUrl(input: string) {
  const value = input.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!allowedProtocols.has(url.protocol)) return "";

    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : "";
    }
    if (url.hostname.endsWith("youtube.com")) {
      const id = url.searchParams.get("v") ?? (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : "");
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : value;
    }
    if (url.hostname.endsWith("instagram.com") && !url.pathname.endsWith("/embed")) {
      return `${url.origin}${url.pathname.replace(/\/$/, "")}/embed`;
    }
    return value;
  } catch {
    return "";
  }
}

function escapeClosingTag(value: string, tag: string) {
  return value.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

export function buildSandboxedHtmlDocument(input: {
  html: string;
  css: string;
  javascript: string;
  allowScripts: boolean;
}) {
  const scriptPolicy = input.allowScripts ? "script-src 'unsafe-inline' https:" : "script-src 'none'";
  const script = input.allowScripts && input.javascript.trim()
    ? `<script>${escapeClosingTag(input.javascript, "script")}</script>`
    : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: blob:; media-src https: blob:; style-src 'unsafe-inline' https:; font-src https:; ${scriptPolicy}; connect-src https:; frame-src https:; form-action https:; object-src 'none'; base-uri 'none'" />
  <style>${escapeClosingTag(input.css, "style")}</style>
</head>
<body>${input.html}${script}</body>
</html>`;
}
