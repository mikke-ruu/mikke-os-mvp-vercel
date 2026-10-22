import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { deliverStoredAcademy2BankMail } from "../_shared/academy2-offering-bank-intake.ts";

const reply = (status: number, value: Record<string, unknown>) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
async function authorized(request: Request, secret: string) {
  // Hash both inputs before comparison: no prefix/length-dependent secret comparison.
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const supplied = request.headers.get("Authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? "";
  const [a, b] = await Promise.all([digest(secret), digest(supplied)]);
  let different = 0; for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

Deno.serve(async request => {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  // This endpoint is not a browser or tenant-admin API. CORS is never enabled.
  if (request.headers.has("Origin")) return reply(403, { error: "worker_only" });
  const secret = Deno.env.get("ACADEMY_RECEIPT_WORKER_SECRET") ?? "";
  if (!/^[a-f0-9]{64,128}$/i.test(secret)) return reply(503, { error: "worker_not_configured" });
  if (!await authorized(request, secret)) return reply(401, { error: "unauthorized" });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "worker_not_configured" });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: jobs, error } = await admin.rpc("academy2_claim_receipt_delivery_jobs", { p_limit: 3 });
    if (error || !Array.isArray(jobs)) return reply(503, { error: "queue_unavailable" });
    let sent = 0, deferred = 0;
    for (const job of jobs) {
      try {
        const { data, error: userError } = await admin.auth.admin.getUserById(job.user_id);
        const outcome = !userError && data.user ? await deliverStoredAcademy2BankMail(admin, data.user, job.application_id, job.request_id, job.offering_id) : "needs_review";
        const { data: finished, error: finishError } = await admin.rpc("academy2_finish_receipt_delivery_job", { p_application: job.application_id, p_token: job.token });
        if (!finishError && finished && outcome === "sent") sent++; else deferred++;
      } catch { deferred++; /* An expired lease can safely be reclaimed. */ }
    }
    return reply(200, { processed: jobs.length, sent, deferred });
  } catch { return reply(503, { error: "worker_unavailable" }); }
});
