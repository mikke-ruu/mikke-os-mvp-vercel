import { createClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";
import { toSupabaseActivityLogInsert, type SupabaseActivityLogInsert } from "./activity-adapter";
import type { UnifiedActivityLog } from "./types";

type ActivityLogTestRow = Pick<
  SupabaseActivityLogInsert,
  | "user_id"
  | "profile_id"
  | "activity_type"
  | "category"
  | "source_service"
  | "source_record_id"
  | "visibility"
  | "status"
  | "display_on_story"
  | "counts_toward_summary"
  | "has_financial_value"
  | "amount"
  | "transaction_type"
  | "payment_status"
> & {
  id: string;
};

export type ItemStudioSupabaseTestResult = {
  ok: true;
  sourceRecordId: string;
  payload: SupabaseActivityLogInsert;
  insert: {
    ok: true;
    id: string;
    source_record_id: string;
  };
  select: {
    ok: true;
    row: ActivityLogTestRow;
  };
  story: {
    visible: boolean;
    public_policy_readable: boolean;
  };
  desk: {
    counted: boolean;
  };
  summary: {
    counted: boolean;
  };
};

const activityLogSelect =
  "id,user_id,profile_id,activity_type,category,source_service,source_record_id,visibility,status,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,payment_status";

export async function saveItemStudioRegistrationSupabaseTest(log: UnifiedActivityLog): Promise<ItemStudioSupabaseTestResult> {
  if (log.appKey !== "item_studio" || log.eventType !== "item_created") {
    throw new Error("This Supabase test is limited to Item Studio item_created logs.");
  }

  return saveItemStudioSupabaseTest(log, {
    idPrefix: "supabase-test-item-created",
    sourcePrefix: "item-studio-test",
    overrides: {
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      amount: undefined,
      amountType: "none",
      countsTowardSummary: true,
      metadata: {
        ...log.metadata,
        category: "product",
        paymentStatus: "not_required"
      }
    }
  });
}

export async function saveItemStudioSaleSupabaseTest(log: UnifiedActivityLog): Promise<ItemStudioSupabaseTestResult> {
  if (log.appKey !== "item_studio" || log.eventType !== "item_sold") {
    throw new Error("This Supabase test is limited to Item Studio item_sold logs.");
  }

  return saveItemStudioSupabaseTest(log, {
    idPrefix: "supabase-test-item-sold",
    sourcePrefix: "item-studio-sale-test",
    overrides: {
      visibility: "public",
      storyEnabled: true,
      deskEnabled: true,
      amount: 4800,
      amountType: "income",
      countsTowardSummary: true,
      metadata: {
        ...log.metadata,
        category: "product",
        paymentStatus: "paid"
      }
    }
  });
}

type ItemStudioSupabaseTestConfig = {
  idPrefix: string;
  sourcePrefix: string;
  overrides: Partial<UnifiedActivityLog>;
};

async function saveItemStudioSupabaseTest(
  log: UnifiedActivityLog,
  config: ItemStudioSupabaseTestConfig
): Promise<ItemStudioSupabaseTestResult> {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user) throw new Error("Supabase test save needs a logged-in user.");

  const profile = await getProfile(session.user.id);
  if (!profile) throw new Error("Supabase test save needs a profile for the logged-in user.");

  const testLog: UnifiedActivityLog = {
    ...log,
    ...config.overrides,
    id: `${config.idPrefix}-${Date.now()}`,
    profileId: profile.id,
    sourceId: `${config.sourcePrefix}-${new Date().toISOString()}-${crypto.randomUUID()}`,
    metadata: {
      ...log.metadata,
      ...config.overrides.metadata
    }
  };

  const payload = toSupabaseActivityLogInsert(testLog, {
    userId: session.user.id,
    profileId: profile.id
  });

  const { data: inserted, error: insertError } = await supabase
    .from("activity_logs")
    .insert(payload)
    .select(activityLogSelect)
    .single();

  if (insertError) throw insertError;
  if (!inserted) throw new Error("Supabase test save did not return an inserted row.");

  const { data: selected, error: selectError } = await supabase
    .from("activity_logs")
    .select(activityLogSelect)
    .eq("source_service", "item_studio")
    .eq("source_record_id", payload.source_record_id)
    .single();

  if (selectError) throw selectError;
  if (!selected) throw new Error("Supabase test select did not return a row.");

  const anonClient = createAnonClient();
  const { data: publicSelected, error: publicSelectError } = await anonClient
    .from("activity_logs")
    .select("id,source_service,source_record_id,visibility,display_on_story")
    .eq("source_service", "item_studio")
    .eq("source_record_id", payload.source_record_id)
    .maybeSingle();

  if (publicSelectError) throw publicSelectError;

  const row = selected as ActivityLogTestRow;

  return {
    ok: true,
    sourceRecordId: payload.source_record_id,
    payload,
    insert: {
      ok: true,
      id: String(inserted.id),
      source_record_id: String(inserted.source_record_id)
    },
    select: {
      ok: true,
      row
    },
    story: {
      visible: row.visibility === "public" && row.display_on_story === true,
      public_policy_readable: Boolean(publicSelected)
    },
    desk: {
      counted: row.has_financial_value === true && row.amount !== null && row.transaction_type !== "none"
    },
    summary: {
      counted: row.counts_toward_summary === true
    }
  };
}

function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
