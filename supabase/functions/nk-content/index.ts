// 認定講座（スキルビジネス構築）教科書サイト: 購入コードで有料章の本文を返す
//
// 有料章の本文は公開サイトの data.js には置かない（View Source で読めてしまうため）。
// 本文は nintei_koza_chapters にだけ置き、匿名からは読めないようにしてある。
// この関数だけが service role で照合し、有効なコードのときに本文を返す。
//
// 入力: POST { code: string, chapterId: string }
//   chapterId が "verify" のときは本文を返さず、コードの有効性だけを返す。
// 出力: { ok: true, role, email }            … verify
//       { ok: true, chapterId, body }        … 本文
//       { ok: false, reason }                … 失敗
//
// コードの有無と停止中の区別は返さない（総当たりの手がかりを与えないため）。

import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };

// 発行するコードの形: 英数8文字（読み間違えやすい文字は使わない）。ハイフンは表記上のみ。
const CODE_PATTERN = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function normalizeCode(raw: unknown) {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase().replace(/\s/g, "");
  if (!CODE_PATTERN.test(cleaned)) return null;
  return cleaned.replace("-", "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);

  let payload: { code?: unknown; chapterId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }

  const code = normalizeCode(payload.code);
  const chapterId = typeof payload.chapterId === "string" ? payload.chapterId.trim() : "";

  if (!code || !chapterId) {
    return json({ ok: false, reason: "invalid_code" }, 200);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // 保存時はハイフン無しの8文字で統一する
  const { data: purchase, error: purchaseError } = await supabase
    .from("nintei_koza_purchases")
    .select("code, email, role, active")
    .eq("code", code)
    .maybeSingle();

  if (purchaseError) return json({ ok: false, reason: "server" }, 500);

  // 「存在しない」と「停止中」を区別して返さない
  if (!purchase || !purchase.active) {
    return json({ ok: false, reason: "invalid_code" }, 200);
  }

  // 最終利用日を記録する（失敗しても本文の返却は止めない）
  await supabase
    .from("nintei_koza_purchases")
    .update({ last_used_at: new Date().toISOString() })
    .eq("code", code);

  if (chapterId === "verify") {
    return json({ ok: true, role: purchase.role, email: purchase.email });
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("nintei_koza_chapters")
    .select("chapter_id, body")
    .eq("chapter_id", chapterId)
    .maybeSingle();

  if (chapterError) return json({ ok: false, reason: "server" }, 500);
  if (!chapter) return json({ ok: false, reason: "not_found" }, 200);

  return json({ ok: true, chapterId: chapter.chapter_id, body: chapter.body });
});
