import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.108.2";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

async function deliverEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey
    },
    body: JSON.stringify({
      from: "mikkeOS Academy <no-reply@auth.mikke-os.com>",
      to: [input.to],
      subject: input.subject,
      html: input.html
    })
  });
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(result.message ?? "email delivery failed");
  return result.id ?? null;
}

async function markDelivery(admin: SupabaseClient, input: {
  applicationId: string;
  recipientKind: "applicant" | "headquarters";
  status: "sending" | "sent" | "failed";
  providerMessageId?: string | null;
  lastError?: string | null;
  attemptCount?: number;
}) {
  const now = new Date().toISOString();
  const { error } = await admin.from("academy_application_notifications").upsert({
    application_id: input.applicationId,
    recipient_kind: input.recipientKind,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
    last_error: input.lastError ?? null,
    ...(input.attemptCount ? { attempt_count: input.attemptCount } : {}),
    sent_at: input.status === "sent" ? now : null,
    updated_at: now
  }, { onConflict: "application_id,recipient_kind" });
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "ログインが必要です。" }, 401);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: "ログインを確認できませんでした。" }, 401);

    const body = await request.json() as { application_id?: string };
    if (!body.application_id) return json({ error: "申込IDが必要です。" }, 400);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: application, error: applicationError } = await admin
      .from("academy_applications")
      .select("id, headquarters_id, applicant_name, applicant_email, payment_provider, provider_checkout_url, academy_courses(name, payment_url), academy_headquarters(contact_email, default_payment_note)")
      .eq("id", body.application_id)
      .eq("intake_source", "honbu")
      .maybeSingle();
    if (applicationError || !application) return json({ error: "本部受付の申込を確認できませんでした。" }, 404);

    const { data: role, error: roleError } = await userClient.rpc("academy_get_my_headquarters_role", {
      p_headquarters_id: application.headquarters_id
    });
    if (roleError || !(["owner", "administrator"] as unknown[]).includes(role)) {
      return json({ error: "メールを再送する権限がありません。" }, 403);
    }

    const { data: existing, error: existingError } = await admin
      .from("academy_application_notifications")
      .select("recipient_kind,status,attempt_count")
      .eq("application_id", application.id);
    if (existingError) throw existingError;
    const sentKinds = new Set((existing ?? []).filter((item) => item.status === "sent").map((item) => item.recipient_kind));
    const attemptCounts = new Map((existing ?? []).map((item) => [item.recipient_kind, Number(item.attempt_count ?? 0)]));
    const course = Array.isArray(application.academy_courses) ? application.academy_courses[0] : application.academy_courses;
    const headquarters = Array.isArray(application.academy_headquarters) ? application.academy_headquarters[0] : application.academy_headquarters;
    const applicantEmail = String(application.applicant_email ?? "");
    let paymentUrl = String(application.provider_checkout_url ?? course?.payment_url ?? "");
    if (application.payment_provider === "stripe" && paymentUrl) {
      const url = new URL(paymentUrl);
      url.searchParams.set("client_reference_id", String(application.id));
      url.searchParams.set("prefilled_email", applicantEmail);
      paymentUrl = url.toString();
    }
    const paymentNote = String(headquarters?.default_payment_note ?? "").trim();
    const style = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#2f2c35;max-width:560px;margin:auto";
    const deliveries = [
      {
        kind: "applicant" as const,
        to: applicantEmail,
        subject: `【mikkeOS Academy】${course?.name ?? "講座"}のお申込み受付`,
        html: `<div style="${style}"><h1 style="font-size:20px;color:#4655c7">お申込み受付のご案内</h1><p>${escapeHtml(String(application.applicant_name))} 様</p><p>${escapeHtml(course?.name ?? "講座")}のお申込みを受け付けています。</p>${paymentNote ? `<h2 style="font-size:16px">お支払いのご案内</h2><p>${textToHtml(paymentNote)}</p>` : ""}${paymentUrl ? `<p><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#4655c7;color:#fff;text-decoration:none;font-weight:700">お支払い手続きへ進む</a></p>` : ""}<p style="font-size:13px;color:#6f6b78">受付番号: ${escapeHtml(String(application.id))}</p></div>`
      },
      ...(headquarters?.contact_email ? [{
        kind: "headquarters" as const,
        to: String(headquarters.contact_email),
        subject: `【Academy本部受付】${course?.name ?? "講座"} / ${String(application.applicant_name)}`,
        html: `<div style="${style}"><h1 style="font-size:20px">Academy本部の申込通知（再送）</h1><p>講座: ${escapeHtml(course?.name ?? "")}</p><p>申込者: ${escapeHtml(String(application.applicant_name))}</p><p>連絡先: ${escapeHtml(applicantEmail)}</p><p>受付番号: ${escapeHtml(String(application.id))}</p></div>`
      }] : [])
    ].filter((delivery) => delivery.to && !sentKinds.has(delivery.kind));

    if (deliveries.length === 0) return json({ sent: true, sent_count: 0, message: "再送が必要なメールはありません。" });
    let sentCount = 0;
    for (const delivery of deliveries) {
      const attemptCount = (attemptCounts.get(delivery.kind) ?? 0) + 1;
      await markDelivery(admin, {
        applicationId: application.id,
        recipientKind: delivery.kind,
        status: "sending",
        attemptCount
      });
      try {
        const messageId = await deliverEmail({
          to: delivery.to,
          subject: delivery.subject,
          html: delivery.html,
          idempotencyKey: `academy-application-${application.id}-${delivery.kind}-retry-${crypto.randomUUID()}`
        });
        await markDelivery(admin, { applicationId: application.id, recipientKind: delivery.kind, status: "sent", providerMessageId: messageId });
        sentCount += 1;
      } catch (error) {
        await markDelivery(admin, {
          applicationId: application.id,
          recipientKind: delivery.kind,
          status: "failed",
          lastError: (error instanceof Error ? error.message : "email delivery failed").slice(0, 500)
        });
      }
    }
    return json({ sent: sentCount === deliveries.length, sent_count: sentCount, attempted_count: deliveries.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "メール再送に失敗しました。" }, 500);
  }
});
