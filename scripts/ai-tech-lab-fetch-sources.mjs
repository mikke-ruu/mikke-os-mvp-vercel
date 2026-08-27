const limitArgIndex = process.argv.indexOf("--limit");
const parsedLimit = limitArgIndex >= 0 ? Number(process.argv[limitArgIndex + 1]) : 8;
const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 30) : 8;

const sources = [
  {
    sourceKey: "openai-news",
    publisher: "OpenAI",
    feedUrl: "https://openai.com/news/rss.xml",
    officialUrl: "https://openai.com/news/",
    format: "rss",
    relevance: /codex|agent|developer|model|image|video|api|chatgpt|automation|design/i
  },
  {
    sourceKey: "google-ai-developers",
    publisher: "Google",
    feedUrl: "https://developers.googleblog.com/feeds/posts/default",
    officialUrl: "https://ai.google.dev/gemini-api/docs/changelog",
    format: "atom",
    relevance: /gemini|agent|artificial intelligence|machine learning|generative ai|image|video|web|ui|automation|cod(e|ing)/i
  },
  {
    sourceKey: "github-changelog",
    publisher: "GitHub",
    feedUrl: "https://github.blog/changelog/feed/",
    officialUrl: "https://github.blog/changelog/",
    format: "rss",
    relevance: /copilot|agent|ai|actions|automation|codespaces|developer|code|security/i
  }
];

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function parseRss(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => {
    const block = match[1];
    return {
      externalId: tag(block, "guid") || tag(block, "link"),
      title: tag(block, "title"),
      sourceUrl: tag(block, "link"),
      publishedAt: tag(block, "pubDate") || tag(block, "dc:date"),
      sourceExcerpt: tag(block, "description") || tag(block, "content:encoded")
    };
  });
}

function parseAtom(xml) {
  return [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const block = match[1];
    const link = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
    return {
      externalId: tag(block, "id") || link,
      title: tag(block, "title"),
      sourceUrl: decodeXml(link),
      publishedAt: tag(block, "published") || tag(block, "updated"),
      sourceExcerpt: tag(block, "summary") || tag(block, "content")
    };
  });
}

if (process.argv.includes("--self-test")) {
  const rss = parseRss(`<?xml version="1.0"?><rss><channel><item><title>Codex agent update</title><link>https://example.com/codex</link><guid>codex-1</guid><pubDate>Thu, 27 Aug 2026 00:00:00 GMT</pubDate><description><![CDATA[New agent workflow]]></description></item></channel></rss>`);
  const atom = parseAtom(`<?xml version="1.0"?><feed><entry><title>Gemini image update</title><link href="https://example.com/gemini"/><id>gemini-1</id><updated>2026-08-27T00:00:00Z</updated><summary>New image model</summary></entry></feed>`);
  if (rss[0]?.externalId !== "codex-1" || rss[0]?.title !== "Codex agent update") throw new Error("RSS parser self-test failed");
  if (atom[0]?.externalId !== "gemini-1" || atom[0]?.sourceUrl !== "https://example.com/gemini") throw new Error("Atom parser self-test failed");
  process.stdout.write("PASS official feed parsers\n");
  process.exit(0);
}

async function fetchSource(source) {
  const response = await fetch(source.feedUrl, {
    headers: {
      "User-Agent": "mikkeOS-AI-Tech-Lab/0.1 manual-review"
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${source.publisher}: HTTP ${response.status}`);
  const xml = await response.text();
  const parsed = source.format === "atom" ? parseAtom(xml) : parseRss(xml);
  return parsed
    .filter((item) => item.title && item.sourceUrl && source.relevance.test(`${item.title} ${item.sourceExcerpt}`))
    .slice(0, limit)
    .map((item) => ({
      source_key: source.sourceKey,
      publisher: source.publisher,
      official_source_url: source.officialUrl,
      external_id: item.externalId || item.sourceUrl,
      title: item.title,
      source_url: item.sourceUrl,
      published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      source_excerpt: item.sourceExcerpt.slice(0, 500),
      fetched_at: new Date().toISOString(),
      review_status: "needs_human_or_codex_review"
    }));
}

const settled = await Promise.allSettled(sources.map(fetchSource));
const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
const errors = settled.flatMap((result, index) => result.status === "rejected" ? [{
  source_key: sources[index].sourceKey,
  message: result.reason instanceof Error ? result.reason.message : "取得できませんでした"
}] : []);

process.stdout.write(`${JSON.stringify({
  generated_at: new Date().toISOString(),
  mode: "manual_review_only",
  writes_to_database: false,
  sources_checked: sources.length,
  item_count: items.length,
  items,
  errors
}, null, 2)}\n`);

if (items.length === 0) process.exitCode = 1;
