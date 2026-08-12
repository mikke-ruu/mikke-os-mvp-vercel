import { supabase } from "@/lib/supabase/client";

export type EmailPreferences = {
  user_id: string;
  newsletter_enabled: boolean;
  product_updates_enabled: boolean;
  consent_source: "signup" | "settings" | "import";
  consented_at: string | null;
  updated_at: string;
};

export async function getEmailPreferences(userId: string): Promise<EmailPreferences | null> {
  const { data, error } = await supabase
    .from("mikkeos_email_preferences")
    .select("user_id, newsletter_enabled, product_updates_enabled, consent_source, consented_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmailPreferences | null;
}

export async function saveEmailPreferences(
  userId: string,
  input: Pick<EmailPreferences, "newsletter_enabled" | "product_updates_enabled">,
  source: EmailPreferences["consent_source"] = "settings"
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("mikkeos_email_preferences").upsert({
    user_id: userId,
    ...input,
    consent_source: source,
    consented_at: input.newsletter_enabled || input.product_updates_enabled ? now : null,
    updated_at: now
  }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}
