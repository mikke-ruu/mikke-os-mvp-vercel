import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function base64(bytes: ArrayBuffer) {
  let binary = "";
  for (const value of new Uint8Array(bytes)) binary += String.fromCharCode(value);
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifySquareSignature(rawBody: string, signature: string, notificationUrl: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = base64(await crypto.subtle.sign("HMAC", key, encoder.encode(`${notificationUrl}${rawBody}`)));
  return constantTimeEqual(signature, expected);
}

type SquareEvent = {
  event_id?: string;
  type?: string;
  data?: { object?: { payment?: {
    id?: string;
    order_id?: string;
    status?: string;
    amount_money?: { amount?: number; currency?: string };
  } } };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const secret = Deno.env.get("ACADEMY_SQUARE_WEBHOOK_SIGNATURE_KEY") ?? "";
  const notificationUrl = Deno.env.get("ACADEMY_SQUARE_NOTIFICATION_URL") ?? "";
  if (!secret || !notificationUrl || !await verifySquareSignature(rawBody, signature, notificationUrl, secret)) {
    return json({ error: "Invalid signature" }, 401);
  }

  try {
    const event = JSON.parse(rawBody) as SquareEvent;
    const payment = event.data?.object?.payment;
    if (event.type !== "payment.updated" || payment?.status !== "COMPLETED") return json({ received: true, ignored: true });
    if (!event.event_id || !payment.id || !payment.order_id || !Number.isInteger(payment.amount_money?.amount) || !payment.amount_money?.currency) {
      return json({ error: "Invalid payment event" }, 400);
    }
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: application, error: lookupError } = await admin
      .from("academy_applications")
      .select("id")
      .eq("payment_provider", "square")
      .eq("provider_checkout_id", payment.order_id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!application) return json({ received: true, ignored: true, reason: "checkout_not_bound" });
    const { error } = await admin.rpc("academy_record_payment_event", {
      p_provider: "square",
      p_provider_event_id: event.event_id,
      p_application_id: application.id,
      p_provider_payment_id: payment.id,
      p_amount: payment.amount_money.amount,
      p_currency: payment.amount_money.currency.toUpperCase(),
      p_is_test: (Deno.env.get("ACADEMY_SQUARE_ENVIRONMENT") ?? "sandbox") !== "production"
    });
    if (error) throw error;
    return json({ received: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, 400);
  }
});
