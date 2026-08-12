import { supabase } from "@/lib/supabase/client";

type EmailDeliveryResult = {
  sent: boolean;
  recipient?: string;
};

async function invokeEmailDelivery(body: Record<string, string>): Promise<EmailDeliveryResult> {
  const { data, error } = await supabase.functions.invoke<EmailDeliveryResult>("mikkeos-email", { body });
  if (error) {
    let message = error.message;
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      const details = await context.clone().json().catch(() => null) as { error?: string } | null;
      if (details?.error) message = details.error;
    }
    throw new Error(message);
  }
  if (!data) throw new Error("メール送信結果を確認できませんでした。");
  return data;
}

export function sendWelcomeEmail(): Promise<EmailDeliveryResult> {
  return invokeEmailDelivery({ action: "welcome" });
}

export function sendCampaignTestEmail(campaignId: string): Promise<EmailDeliveryResult> {
  return invokeEmailDelivery({ action: "campaign_test", campaign_id: campaignId });
}
