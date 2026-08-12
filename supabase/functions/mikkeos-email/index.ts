import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };
const MAX_RECIPIENTS_PER_RUN = 300;

type Campaign = {
  id: string;
  campaign_type: "essential_notice" | "newsletter" | "product_update";
  audience_kind: "all_accounts" | "newsletter_subscribers" | "product_update_subscribers";
  subject: string;
  preview_text: string;
  body_text: string;
  status: "draft" | "sending" | "sent" | "cancelled";
  last_test_fingerprint: string | null;
};

type RequestBody = {
  action?: string;
  campaign_id?: string;
  expected_recipient_count?: number;
  confirmation_text?: string;
  test_confirmed?: boolean;
};

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

function campaignConfirmationText(campaign: Campaign, recipientCount: number) {
  return campaign.campaign_type === "essential_notice"
    ? `重要なお知らせを${recipientCount}人に配信する`
    : `${recipientCount}人に配信する`;
}

async function campaignFingerprint(campaign: Pick<Campaign, "campaign_type" | "audience_kind" | "subject" | "preview_text" | "body_text">) {
  const payload = JSON.stringify([
    campaign.campaign_type,
    campaign.audience_kind,
    campaign.subject,
    campaign.preview_text,
    campaign.body_text
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function campaignHtml(campaign: Campaign) {
  const preview = campaign.preview_text
    ? `<p style="color:#6f6b78">${textToHtml(campaign.preview_text)}</p>`
    : "";
  const preferenceNote = campaign.campaign_type === "essential_notice"
    ? "このメールは、アカウント・安全・サービス利用に関する重要なお知らせです。"
    : 'メールの受信設定は、<a href="https://app.mikke-os.com/settings" style="color:#4655c7">mikkeOSの設定</a>から変更できます。';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#2f2c35;max-width:560px;margin:auto">
      ${preview}
      <div>${textToHtml(campaign.body_text)}</div>
      <hr style="margin:28px 0;border:0;border-top:1px solid #e7e4ec" />
      <p style="font-size:13px;color:#6f6b78">${preferenceNote}</p>
      <p style="font-size:13px;color:#6f6b78">mikkeOS</p>
    </div>`;
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

  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) {
    throw new Error(typeof result.message === "string" ? result.message : "メール送信に失敗しました。");
  }
  return result;
}

async function requireCampaignAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("mikkeos_hq_staff_members")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (error || !data) throw new Error("本配信は、本部のオーナーまたは管理者だけが実行できます。");
}

async function loadCampaign(admin: SupabaseClient, campaignId: string): Promise<Campaign> {
  const { data, error } = await admin
    .from("mikkeos_email_campaigns")
    .select("id, campaign_type, audience_kind, subject, preview_text, body_text, status, last_test_fingerprint")
    .eq("id", campaignId)
    .maybeSingle();
  if (error || !data) throw new Error("配信原稿を確認できませんでした。");
  if (!(["draft", "sending"] as string[]).includes(data.status)) {
    throw new Error("この原稿は、すでに配信済みか配信対象外です。");
  }
  return data as Campaign;
}

async function listAllConfirmedUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const confirmed = data.users.filter((candidate) => candidate.email && candidate.email_confirmed_at);
    users.push(...confirmed);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function listRecipients(admin: SupabaseClient, campaign: Campaign): Promise<User[]> {
  const users = await listAllConfirmedUsers(admin);
  if (campaign.audience_kind === "all_accounts") return users.sort((a, b) => a.id.localeCompare(b.id));

  const preferenceColumn = campaign.audience_kind === "newsletter_subscribers"
    ? "newsletter_enabled"
    : "product_updates_enabled";
  const { data, error } = await admin
    .from("mikkeos_email_preferences")
    .select("user_id")
    .eq(preferenceColumn, true);
  if (error) throw error;
  const optedIn = new Set((data ?? []).map((row) => String(row.user_id)));
  return users.filter((candidate) => optedIn.has(candidate.id)).sort((a, b) => a.id.localeCompare(b.id));
}

async function sendCampaign(admin: SupabaseClient, campaign: Campaign, recipients: User[], actorUserId: string) {
  if (campaign.status === "draft") {
    const { data, error } = await admin
      .from("mikkeos_email_campaigns")
      .update({ status: "sending", recipient_count: recipients.length, updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const refreshed = await loadCampaign(admin, campaign.id);
      if (refreshed.status !== "sending") throw new Error("配信状態が変わりました。画面を読み直してください。");
    }
  }

  await admin.from("mikkeos_hq_audit_logs").insert({
    actor_user_id: actorUserId,
    action: "campaign_send_started",
    entity_type: "mikkeos_email_campaigns",
    entity_id: campaign.id,
    details: { recipient_count: recipients.length, audience_kind: campaign.audience_kind }
  });

  const { data: existing, error: existingError } = await admin
    .from("mikkeos_email_deliveries")
    .select("recipient_user_id, status, attempt_count, last_attempt_at")
    .eq("campaign_id", campaign.id);
  if (existingError) throw existingError;
  const deliveryByUser = new Map((existing ?? []).map((row) => [String(row.recipient_user_id), row]));
  const html = campaignHtml(campaign);
  let failedThisRun = 0;

  for (const recipient of recipients) {
    if (!recipient.email) continue;
    const previous = deliveryByUser.get(recipient.id);
    if (previous?.status === "sent") continue;
    if (previous?.status === "sending" && previous.last_attempt_at) {
      const stillActive = Date.now() - new Date(previous.last_attempt_at).getTime() < 10 * 60 * 1000;
      if (stillActive) continue;
    }

    const now = new Date().toISOString();
    const { error: pendingError } = await admin.from("mikkeos_email_deliveries").upsert({
      campaign_id: campaign.id,
      recipient_user_id: recipient.id,
      status: "sending",
      attempt_count: Number(previous?.attempt_count ?? 0) + 1,
      last_error: null,
      last_attempt_at: now,
      updated_at: now
    }, { onConflict: "campaign_id,recipient_user_id" });
    if (pendingError) throw pendingError;

    try {
      const delivered = await deliverEmail({
        to: recipient.email,
        subject: campaign.subject,
        html,
        idempotencyKey: `campaign-${campaign.id}-user-${recipient.id}`
      });
      const sentAt = new Date().toISOString();
      const { error: sentError } = await admin
        .from("mikkeos_email_deliveries")
        .update({
          status: "sent",
          provider_message_id: delivered.id ?? null,
          last_error: null,
          sent_at: sentAt,
          updated_at: sentAt
        })
        .eq("campaign_id", campaign.id)
        .eq("recipient_user_id", recipient.id);
      if (sentError) throw sentError;
    } catch (error) {
      failedThisRun += 1;
      const message = error instanceof Error ? error.message : "メール送信に失敗しました。";
      await admin
        .from("mikkeos_email_deliveries")
        .update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("campaign_id", campaign.id)
        .eq("recipient_user_id", recipient.id);
    }

    // Resend's default limit is 5 requests/second. Stay below it, including other app traffic.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const { data: results, error: resultsError } = await admin
    .from("mikkeos_email_deliveries")
    .select("recipient_user_id, status")
    .eq("campaign_id", campaign.id);
  if (resultsError) throw resultsError;
  const currentRecipientIds = new Set(recipients.map((recipient) => recipient.id));
  const currentResults = (results ?? []).filter((row) => currentRecipientIds.has(String(row.recipient_user_id)));
  const sentCount = currentResults.filter((row) => row.status === "sent").length;
  const failedCount = currentResults.filter((row) => row.status === "failed").length;
  const completed = sentCount >= recipients.length && failedCount === 0;
  const finishedAt = new Date().toISOString();

  const { error: campaignUpdateError } = await admin
    .from("mikkeos_email_campaigns")
    .update({
      status: completed ? "sent" : "sending",
      recipient_count: sentCount,
      sent_at: completed ? finishedAt : null,
      updated_at: finishedAt
    })
    .eq("id", campaign.id);
  if (campaignUpdateError) throw campaignUpdateError;

  await admin.from("mikkeos_hq_audit_logs").insert({
    actor_user_id: actorUserId,
    action: completed ? "campaign_sent" : "campaign_send_incomplete",
    entity_type: "mikkeos_email_campaigns",
    entity_id: campaign.id,
    details: { sent_count: sentCount, failed_count: failedCount, failed_this_run: failedThisRun }
  });

  return { completed, sentCount, failedCount };
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

    const body = await request.json() as RequestBody;

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
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRoleKey) return json({ error: "本部配信用のサーバー設定を確認できませんでした。" }, 500);
      const { data: campaign, error: campaignError } = await supabase
        .from("mikkeos_email_campaigns")
        .select("id, campaign_type, audience_kind, subject, preview_text, body_text, status")
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
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const testedAt = new Date().toISOString();
      const { error: testProofError } = await admin
        .from("mikkeos_email_campaigns")
        .update({
          last_tested_at: testedAt,
          last_tested_by: user.id,
          last_test_fingerprint: await campaignFingerprint(campaign as Campaign),
          updated_at: testedAt
        })
        .eq("id", campaign.id)
        .eq("status", "draft");
      if (testProofError) throw testProofError;
      return json({ sent: true, recipient: user.email });
    }

    if ((body.action === "campaign_preview" || body.action === "campaign_send") && body.campaign_id) {
      await requireCampaignAdmin(supabase, user.id);
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRoleKey) return json({ error: "本部配信用のサーバー設定を確認できませんでした。" }, 500);
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const campaign = await loadCampaign(admin, body.campaign_id);
      const testReady = campaign.last_test_fingerprint === await campaignFingerprint(campaign);
      const recipients = await listRecipients(admin, campaign);
      const confirmationText = campaignConfirmationText(campaign, recipients.length);

      if (body.action === "campaign_preview") {
        return json({
          recipient_count: recipients.length,
          confirmation_text: confirmationText,
          campaign_status: campaign.status,
          test_ready: testReady
        });
      }

      if (!testReady) {
        return json({ error: "この原稿は、現在の内容でテスト送信されていません。先に『自分にテスト送信』を実行してください。" }, 409);
      }
      if (recipients.length === 0) return json({ error: "現在の配信対象者は0人です。配信は実行しませんでした。" }, 409);
      if (recipients.length > MAX_RECIPIENTS_PER_RUN) {
        return json({ error: `安全のため、1回の配信上限は${MAX_RECIPIENTS_PER_RUN}人です。配信方法の拡張が必要です。` }, 409);
      }
      if (body.expected_recipient_count !== recipients.length || body.confirmation_text !== confirmationText) {
        return json({ error: "対象人数が変わりました。もう一度『配信前の最終確認』から確認してください。" }, 409);
      }
      if (body.test_confirmed !== true) {
        return json({ error: "テストメールを確認したチェックが必要です。" }, 400);
      }

      const result = await sendCampaign(admin, campaign, recipients, user.id);
      return json({
        sent: result.completed,
        completed: result.completed,
        sent_count: result.sentCount,
        failed_count: result.failedCount
      });
    }

    return json({ error: "送信内容を確認できませんでした。" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "メール送信に失敗しました。";
    const status = message.includes("オーナーまたは管理者") ? 403 : 500;
    return json({ error: message }, status);
  }
});
