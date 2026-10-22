import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.108.2";
import { prepareAcademy2BankApplicantMail } from "./academy2-bank-applicant-mail.mjs";
import { prepareAcademy2ExternalApplicantMail } from "./academy2-external-applicant-mail.mjs";

type BankBody = {
  kind: "academy2_offering_bank" | "academy2_offering_external";
  offering_id?: string;
  request_id?: string;
  name?: string;
  terms?: string;
  agree?: boolean;
  price?: number;
  class_id?: string | null;
  answers?: Record<string, string>;
  seller_publication?: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (request: Request, cors: (request: Request) => Record<string, string>, status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { ...cors(request), "Content-Type": "application/json; charset=utf-8" } });
const answer = (request: Request, cors: (request: Request) => Record<string, string>, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { headers: { ...cors(request), "Content-Type": "application/json; charset=utf-8" } });

function clientCredentials() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anon || !service) throw new Error("academy2_mail_configuration_missing");
  return { url, anon, service };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function send(mail: { to: string; subject: string; html: string; idempotencyKey: string }) {
  if (Deno.env.get("ACADEMY_LOCAL_FAKE_MAIL") === "true"
      && /^http:\/\/(?:127\.0\.0\.1|localhost):57982\/?$/.test(Deno.env.get("SUPABASE_URL") ?? "")) {
    return `local-fake-${mail.idempotencyKey}`;
  }
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("mail_provider_unavailable");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": mail.idempotencyKey },
    body: JSON.stringify({ from: "mikkeOS Academy <no-reply@auth.mikke-os.com>", to: [mail.to], subject: mail.subject, html: mail.html }),
    signal: AbortSignal.timeout(15000)
  });
  const value = await response.json().catch(() => ({})) as { id?: string };
  if (!response.ok || !value.id) throw new Error("mail_provider_unconfirmed");
  return value.id;
}

export async function deliverStoredAcademy2BankMail(
  admin: SupabaseClient, user: User, applicationId: string, requestId: string, offeringId: string
): Promise<"sent" | "needs_review"> {
  try {
    const { data: application, error: applicationError } = await admin.from("academy_offering_applications")
      .select("id,headquarters_id,learner_user_id,request_token,offering_id,payment_method,applicant_email,applicant_name,offering_title,currency,price")
      .eq("id", applicationId).single();
    if (applicationError || !application) throw new Error("stored_application_unavailable");
    const [{ data: offering, error: offeringError }, { data: headquarters, error: headquartersError }] = await Promise.all([
      admin.from("academy_offerings").select("id,headquarters_id,status").eq("id", application.offering_id).single(),
      admin.from("academy_headquarters").select("id,default_payment_note").eq("id", application.headquarters_id).single()
    ]);
    if (offeringError || headquartersError) throw new Error("stored_context_unavailable");
    if (application.payment_method !== "bank" && application.payment_method !== "external") throw new Error("unsupported_receipt_payment");
    const {data: contentSnapshot, error: contentError} = await admin.rpc(application.payment_method === "bank" ? "academy2_bank_receipt_content" : "academy2_external_receipt_content", {
      p_application: application.id, p_user: user.id, p_request: requestId
    });
    if (contentError) throw new Error("stored_receipt_content_unavailable");
    const prepare = application.payment_method === "bank" ? prepareAcademy2BankApplicantMail : prepareAcademy2ExternalApplicantMail;
    const mail = prepare({
      user, request: { requestToken: requestId, offeringId }, application, offering, headquarters, contentSnapshot
    });
    const digest = await sha256(JSON.stringify({ to: mail.to, subject: mail.subject, html: mail.html }));
    const { data: claim, error: claimError } = await admin.rpc("academy2_claim_offering_applicant_mail", {
      p_application: application.id, p_user: user.id, p_request: requestId, p_payload_sha256: digest
    });
    if (claimError) throw new Error("mail_log_unavailable");
    if (claim?.outcome === "sent") return "sent";
    if (claim?.outcome !== "claimed" || !uuid.test(String(claim.token ?? ""))) return "needs_review";
    let providerId: string | null = null;
    try { providerId = await send(mail); } catch { /* The accepted application remains intact. */ }
    const { data: finished, error: finishError } = await admin.rpc("academy2_finish_offering_applicant_mail", {
      p_application: application.id, p_token: claim.token, p_sent: !!providerId,
      p_provider_message_id: providerId, p_error_code: providerId ? null : "delivery_unconfirmed"
    });
    return !finishError && finished && providerId ? "sent" : "needs_review";
  } catch {
    // Never return a private bank note or mail-provider details to a caller.
    return "needs_review";
  }
}

export async function handleAcademy2BankIntake(request: Request, body: BankBody, cors: (request: Request) => Record<string, string>) {
  const method = body.kind === "academy2_offering_external" ? "external" : body.kind === "academy2_offering_bank" ? "bank" : null;
  if (!method || !uuid.test(body.offering_id ?? "") || !uuid.test(body.request_id ?? "") || !body.name?.trim()
      || body.name.length > 200 || !body.terms || body.agree !== true
      || !Number.isSafeInteger(body.price) || Number(body.price) < 0
      || (body.class_id != null && !uuid.test(body.class_id))
      || (body.seller_publication !== undefined && !uuid.test(body.seller_publication))
      || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return fail(request, cors, 400, "申込内容を確認してください。");
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!token) return fail(request, cors, 401, "ログインが必要です。");
  const { url, anon, service } = clientCredentials();
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user?.email || !user.email_confirmed_at) return fail(request, cors, 401, "確認済みのメールアドレスでログインしてください。");

  // The existing authenticated RPC is the only application creator. A replay
  // must reuse the same request ID; no service-role application write occurs.
  const { data: receipt, error: intakeError } = await userClient.rpc(body.seller_publication ? "academy2_submit_reviewed_intake_payment" : "academy2_submit_public_intake_payment", {
    p_id: body.offering_id, ...(body.seller_publication ? {p_seller_publication: body.seller_publication} : {p_instructor: false}), p_request: body.request_id,
    p_name: body.name.trim(), p_terms: body.terms, p_agree: true, p_price: body.price,
    p_class: body.class_id ?? null, p_answers: body.answers, p_payment_method: method
  });
  if (intakeError) return fail(request, cors, 409, intakeError.message.includes('seller_publication_changed') ? "販売条件が更新されています。再読み込みして確認してからお申し込みください。" : "申込を受け付けられませんでした。内容を確認して再読み込みしてください。");
  if (!uuid.test(String(receipt?.id ?? ""))) return fail(request, cors, 502, "受付結果を確認できませんでした。申込一覧をご確認ください。");

  const accepted = { id: receipt.id, price: receipt.price, status: receipt.status,
    headquarters_id: receipt.headquarters_id, offering_title: receipt.offering_title,
    payment_method: method, ...(method === "external" ? { external_payment_url: receipt.external_payment_url } : {}) };
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const mailStatus = await deliverStoredAcademy2BankMail(admin, user, receipt.id, body.request_id!, body.offering_id!);
  return answer(request, cors, { ...accepted, mail_status: mailStatus });
}
