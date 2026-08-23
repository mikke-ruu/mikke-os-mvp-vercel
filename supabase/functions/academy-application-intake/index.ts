import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const allowedOrigins = new Set([
  "https://app.mikke-os.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://app.mikke-os.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" }
  });
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

async function createSquareCheckout(input: { applicationId: string; courseName: string; amount: number }) {
  const accessToken = Deno.env.get("ACADEMY_SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("ACADEMY_SQUARE_LOCATION_ID");
  if (!accessToken || !locationId) return null;
  const environment = Deno.env.get("ACADEMY_SQUARE_ENVIRONMENT") ?? "sandbox";
  const apiBase = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  const response = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2026-07-15"
    },
    body: JSON.stringify({
      idempotency_key: `academy-${input.applicationId}`,
      quick_pay: {
        name: input.courseName.slice(0, 255),
        price_money: { amount: input.amount, currency: "JPY" },
        location_id: locationId
      },
      description: `mikkeOS Academy application ${input.applicationId}`,
      payment_note: `Academy受付番号: ${input.applicationId}`
    })
  });
  const result = await response.json().catch(() => ({})) as {
    payment_link?: { order_id?: string; url?: string };
    errors?: Array<{ detail?: string }>;
  };
  if (!response.ok || !result.payment_link?.order_id || !result.payment_link.url) {
    throw new Error(result.errors?.[0]?.detail ?? "Square checkout creation failed");
  }
  return { orderId: result.payment_link.order_id, url: result.payment_link.url };
}

function buildStripePaymentUrl(url: string, applicationId: string, email: string) {
  try {
    const paymentUrl = new URL(url);
    paymentUrl.searchParams.set("client_reference_id", applicationId);
    paymentUrl.searchParams.set("prefilled_email", email);
    return paymentUrl.toString();
  } catch {
    return url;
  }
}

type IntakeBody = {
  course_id?: string;
  class_id?: string | null;
  instructor_id?: string | null;
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string;
  applicant_note?: string;
  form_answers?: Record<string, string>;
  event_date?: string;
  format?: string;
  diploma_name_en?: string;
  applicant_shipping_address?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) return json(request, { error: "Origin not allowed" }, 403);

  try {
    const body = await request.json() as IntakeBody;
    if (body.instructor_id) return json(request, { error: "講師受付はこの送信窓口の対象外です。" }, 400);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const rpcName = body.class_id
      ? "academy_submit_public_class_application"
      : "academy_submit_public_application";
    const rpcArgs = body.class_id
      ? {
          p_course_id: body.course_id,
          p_class_id: body.class_id,
          p_instructor_id: null,
          p_applicant_name: body.applicant_name ?? "",
          p_applicant_email: body.applicant_email ?? "",
          p_applicant_phone: body.applicant_phone ?? "",
          p_applicant_note: body.applicant_note ?? "",
          p_form_answers: body.form_answers ?? {},
          p_diploma_name_en: body.diploma_name_en ?? "",
          p_applicant_shipping_address: body.applicant_shipping_address ?? ""
        }
      : {
          p_course_id: body.course_id,
          p_instructor_id: null,
          p_applicant_name: body.applicant_name ?? "",
          p_applicant_email: body.applicant_email ?? "",
          p_applicant_phone: body.applicant_phone ?? "",
          p_applicant_note: body.applicant_note ?? "",
          p_form_answers: body.form_answers ?? {},
          p_event_date: body.event_date ?? "",
          p_format: body.format ?? "",
          p_diploma_name_en: body.diploma_name_en ?? "",
          p_applicant_shipping_address: body.applicant_shipping_address ?? ""
        };
    const { data, error } = await admin.rpc(rpcName, rpcArgs);
    if (error) throw error;
    const submitted = Array.isArray(data) ? data[0] : data;
    if (!submitted?.application_id) throw new Error("application result missing");

    const { data: application, error: applicationError } = await admin
      .from("academy_applications")
      .select("id, applicant_name, applicant_email, course_id, headquarters_id, intake_source, price, payment_provider, academy_courses(name, code), academy_headquarters(name, contact_email, default_payment_note)")
      .eq("id", submitted.application_id)
      .single();
    if (applicationError) throw applicationError;

    const course = Array.isArray(application.academy_courses) ? application.academy_courses[0] : application.academy_courses;
    const headquarters = Array.isArray(application.academy_headquarters) ? application.academy_headquarters[0] : application.academy_headquarters;
    const applicantEmail = application.applicant_email as string;
    const hqEmail = headquarters?.contact_email as string | null;
    const paymentNote = String(headquarters?.default_payment_note ?? "").trim();
    const applicationId = String(application.id);
    let paymentUrl = typeof submitted.payment_url === "string" ? submitted.payment_url : null;
    if (application.payment_provider === "stripe" && paymentUrl) {
      paymentUrl = buildStripePaymentUrl(paymentUrl, applicationId, applicantEmail);
    }
    if (application.payment_provider === "square") {
      try {
        const checkout = await createSquareCheckout({
          applicationId,
          courseName: course?.name ?? "mikkeOS Academy",
          amount: Number(application.price)
        });
        if (checkout) {
          paymentUrl = checkout.url;
          await admin.from("academy_applications").update({
            provider_checkout_id: checkout.orderId,
            provider_checkout_url: checkout.url
          }).eq("id", applicationId);
        }
      } catch {
        // The application remains accepted. HQ can send a manual payment link,
        // while the failed automatic checkout is visible as a missing checkout id.
        paymentUrl = null;
      }
    }
    const commonStyle = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#2f2c35;max-width:560px;margin:auto";

    const deliveries = [
      {
        kind: "applicant",
        to: applicantEmail,
        subject: `【mikkeOS Academy】${course?.name ?? "講座"}のお申込みを受け付けました`,
        html: `<div style="${commonStyle}"><h1 style="font-size:20px;color:#4655c7">お申込みを受け付けました</h1><p>${escapeHtml(String(application.applicant_name))} 様</p><p>${escapeHtml(course?.name ?? "講座")} のお申込みありがとうございます。本部より改めてご連絡します。</p>${paymentNote ? `<h2 style="font-size:16px">お支払いのご案内</h2><p>${textToHtml(paymentNote)}</p>` : ""}${paymentUrl ? `<p><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#4655c7;color:#fff;text-decoration:none;font-weight:700">お支払い手続きへ進む</a></p>` : ""}<p style="font-size:13px;color:#6f6b78">受付番号: ${escapeHtml(applicationId)}</p></div>`
      },
      ...(hqEmail ? [{
        kind: "headquarters",
        to: hqEmail,
        subject: `【Academy本部受付】${course?.name ?? "講座"} / ${String(application.applicant_name)}`,
        html: `<div style="${commonStyle}"><h1 style="font-size:20px">Academy本部に新しい申込みがありました</h1><p>講座: ${escapeHtml(course?.name ?? "")}</p><p>申込者: ${escapeHtml(String(application.applicant_name))}</p><p>連絡先: ${escapeHtml(applicantEmail)}</p><p>受付番号: ${escapeHtml(applicationId)}</p><p>詳細はAcademyの申込管理から確認してください。</p></div>`
      }] : [])
    ];

    let emailSent = true;
    for (const delivery of deliveries) {
      await admin.from("academy_application_notifications").upsert({
        application_id: applicationId,
        recipient_kind: delivery.kind,
        status: "sending",
        last_error: null,
        updated_at: new Date().toISOString()
      }, { onConflict: "application_id,recipient_kind" });
      try {
        const messageId = await deliverEmail({
          to: delivery.to,
          subject: delivery.subject,
          html: delivery.html,
          idempotencyKey: `academy-application-${applicationId}-${delivery.kind}`
        });
        await admin.from("academy_application_notifications").update({
          status: "sent", provider_message_id: messageId, sent_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }).eq("application_id", applicationId).eq("recipient_kind", delivery.kind);
      } catch (emailError) {
        emailSent = false;
        await admin.from("academy_application_notifications").update({
          status: "failed",
          last_error: (emailError instanceof Error ? emailError.message : "email delivery failed").slice(0, 500),
          updated_at: new Date().toISOString()
        }).eq("application_id", applicationId).eq("recipient_kind", delivery.kind);
      }
    }

    return json(request, { ...submitted, payment_url: paymentUrl, email_sent: emailSent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "application intake failed";
    return json(request, { error: message }, 400);
  }
});
