import { supabase } from "@/lib/supabase/client";

type EmailDeliveryResult = {
  sent: boolean;
  recipient?: string;
};

export type CampaignDeliveryPreview = {
  recipient_count: number;
  confirmation_text: string;
  campaign_status: "draft" | "sending";
  test_ready: boolean;
};

export type CampaignDeliveryResult = {
  sent: boolean;
  completed: boolean;
  sent_count: number;
  failed_count: number;
};

async function invokeEmailDelivery<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("mikkeos-email", { body });
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
  return invokeEmailDelivery<EmailDeliveryResult>({ action: "welcome" });
}

export function sendCampaignTestEmail(campaignId: string): Promise<EmailDeliveryResult> {
  return invokeEmailDelivery<EmailDeliveryResult>({ action: "campaign_test", campaign_id: campaignId });
}

export function previewCampaignDelivery(campaignId: string): Promise<CampaignDeliveryPreview> {
  return invokeEmailDelivery<CampaignDeliveryPreview>({
    action: "campaign_preview",
    campaign_id: campaignId
  });
}

export function sendCampaignToAudience(input: {
  campaignId: string;
  expectedRecipientCount: number;
  confirmationText: string;
}): Promise<CampaignDeliveryResult> {
  return invokeEmailDelivery<CampaignDeliveryResult>({
    action: "campaign_send",
    campaign_id: input.campaignId,
    expected_recipient_count: input.expectedRecipientCount,
    confirmation_text: input.confirmationText,
    test_confirmed: true
  });
}
