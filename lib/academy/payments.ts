import type { AcademyPaymentProvider } from "@/types/database";

export const ACADEMY_PAYMENT_PROVIDER_LABELS: Record<AcademyPaymentProvider, string> = {
  manual: "手動確認",
  stripe: "Stripe",
  square: "Square",
  paycas: "PayCAS"
};

// Static Stripe Payment Links accept client_reference_id. Square automatic
// reconciliation uses a per-application Checkout API link, so no unsupported
// query parameters are appended here. PayCAS/manual are confirmed by HQ.
export function buildAcademyPaymentUrl({
  url,
  provider,
  applicationId,
  email
}: {
  url: string;
  provider: AcademyPaymentProvider;
  applicationId: string;
  email: string;
}) {
  try {
    const paymentUrl = new URL(url);
    if (provider === "stripe") {
      paymentUrl.searchParams.set("client_reference_id", applicationId);
      if (email.trim()) paymentUrl.searchParams.set("prefilled_email", email.trim());
    }
    return paymentUrl.toString();
  } catch {
    return url;
  }
}
