import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

async function deliverEmail(input: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("メール配信用の秘密鍵がまだ設定されていません。");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey
    },
    body: JSON.stringify({
      from: "mikkeOS <no-reply@auth.mikke-os.com>",
      to: [input.to],
      subject: input.subject,
      html: input.html
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result?.message === "string" ? result.message : "メール送信に失敗しました。";
    throw new Error(message);
  }
  return result;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "ログインが必要です。" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } }
    );
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.email) return json({ error: "ログインを確認できませんでした。" }, 401);

    const body = await request.json() as { action?: string; campaign_id?: string };

    if (body.action === "welcome") {
      await deliverEmail({
        to: user.email,
        subject: "【mikkeOS】登録が完了しました",
        idempotencyKey: `welcome-user-${user.id}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#2f2c35;max-width:560px;margin:auto">
            <h1 style="font-size:22px;color:#4655c7">mikkeOSへようこそ</h1>
            <p>メールアドレスの確認と新規登録が完了しました。</p>
            <p>mikkeOSでは、STORYやMarketNoteなどのアプリを、ひとつのmikke IDで利用できます。</p>
            <p><a href="https://app.mikke-os.com/home" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#4655c7;color:#fff;text-decoration:none;font-weight:700">mikkeOSを開く</a></p>
            <p style="font-size:13px;color:#6f6b78">心当たりがない場合は、このメールを削除してください。</p>
            <p>mikkeOS</p>
          </div>`
      });
      return json({ sent: true, recipient: user.email });
    }

    if (body.action === "campaign_test" && body.campaign_id) {
      const { data: campaign, error: campaignError } = await supabase
        .from("mikkeos_email_campaigns")
        .select("id, subject, preview_text, body_text, status")
        .eq("id", body.campaign_id)
        .eq("status", "draft")
        .maybeSingle();
      if (campaignError || !campaign) return json({ error: "下書きを確認できないか、テスト送信の権限がありません。" }, 403);

      const preview = campaign.preview_text
        ? `<p style="color:#6f6b78">${textToHtml(campaign.preview_text)}</p>`
        : "";
      await deliverEmail({
        to: user.email,
        subject: `【テスト】${campaign.subject}`,
        idempotencyKey: `campaign-test-${campaign.id}-${user.id}-${crypto.randomUUID()}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#2f2c35;max-width:560px;margin:auto">
            <p style="padding:10px 12px;border-radius:8px;background:#fff4dc;color:#8a5a00;font-weight:700">これは本部確認用のテストです。利用者には送信されていません。</p>
            ${preview}
            <div>${textToHtml(campaign.body_text)}</div>
            <hr style="margin:28px 0;border:0;border-top:1px solid #e7e4ec" />
            <p style="font-size:13px;color:#6f6b78">mikkeOS</p>
          </div>`
      });
      return json({ sent: true, recipient: user.email });
    }

    return json({ error: "送信内容を確認できませんでした。" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "メール送信に失敗しました。";
    return json({ error: message }, 500);
  }
});
