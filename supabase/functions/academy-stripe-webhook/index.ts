import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)));
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

type StripeEvent = {
  id?: string;
  livemode?: boolean;
  type?: string;
  data?: { object?: {
    id?: string;
    client_reference_id?: string;
    payment_intent?: string | { id?: string } | null;
    payment_status?: string;
    amount_total?: number | null;
    currency?: string | null;
  } };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const secret = Deno.env.get("ACADEMY_STRIPE_WEBHOOK_SECRET") ?? "";
  if (!secret || !await verifyStripeSignature(rawBody, signature, secret)) return json({ error: "Invalid signature" }, 401);

  try {
    const event = JSON.parse(rawBody) as StripeEvent;
    if (event.type !== "checkout.session.completed") return json({ received: true, ignored: true });
    const session = event.data?.object;
    if (!event.id || !session?.client_reference_id || !session.id || session.payment_status !== "paid") {
      return json({ received: true, ignored: true });
    }
    if (!Number.isInteger(session.amount_total) || (session.amount_total ?? -1) < 0 || !session.currency) {
      return json({ error: "Invalid checkout amount" }, 400);
    }
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? session.id;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error } = await admin.rpc("academy_record_payment_event", {
      p_provider: "stripe",
      p_provider_event_id: event.id,
      p_application_id: session.client_reference_id,
      p_provider_payment_id: paymentId,
      p_amount: session.amount_total,
      p_currency: session.currency.toUpperCase(),
      p_is_test: event.livemode !== true
    });
    if (error) throw error;
    return json({ received: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, 400);
  }
});
