import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const env = readEnvFile(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const accessToken = process.env.MIKKEOS_TEST_ACCESS_TOKEN;
const shouldDelete = process.env.MIKKEOS_TEST_DELETE === "1";
const scenario = getScenario(process.argv[2] || process.env.MIKKEOS_TEST_SCENARIO || "safe_private");

if (!supabaseUrl || !supabaseAnonKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

if (!accessToken) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        skipped: true,
        scenario: scenario.key,
        reason: "MIKKEOS_TEST_ACCESS_TOKEN is required. No insert/update/delete was attempted."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const {
  data: { user },
  error: userError
} = await supabase.auth.getUser(accessToken);

if (userError || !user) {
  fail("Could not read authenticated user from MIKKEOS_TEST_ACCESS_TOKEN.", userError);
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id,user_id,handle,display_name")
  .eq("user_id", user.id)
  .order("created_at", { ascending: true })
  .limit(1)
  .single();

if (profileError || !profile) {
  fail("Could not read profile for authenticated user.", profileError);
}

const sourceRecordId = `mikkeos-safe-test-${new Date().toISOString()}-${randomUUID()}`;
const payload = {
  user_id: user.id,
  profile_id: profile.id,
  activity_type: scenario.activityType,
  category: scenario.category,
  source_service: "mikkeos_test",
  source_record_id: sourceRecordId,
  occurred_at: new Date().toISOString(),
  title: scenario.title,
  description: scenario.description,
  visibility: scenario.visibility,
  status: scenario.status,
  display_on_story: scenario.displayOnStory,
  display_in_timeline: scenario.displayOnStory,
  display_as_achievement: scenario.displayOnStory,
  counts_toward_summary: scenario.countsTowardSummary,
  has_financial_value: scenario.hasFinancialValue,
  amount: scenario.amount,
  transaction_type: scenario.transactionType,
  payment_status: scenario.paymentStatus
};

const { data: inserted, error: insertError } = await supabase
  .from("activity_logs")
  .insert(payload)
  .select(
    "id,user_id,profile_id,activity_type,category,source_service,source_record_id,visibility,status,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,payment_status"
  )
  .single();

if (insertError || !inserted) {
  fail("Insert failed.", insertError);
}

const { data: selected, error: selectError } = await supabase
  .from("activity_logs")
  .select(
    "id,user_id,profile_id,activity_type,category,source_service,source_record_id,visibility,status,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,payment_status"
  )
  .eq("source_service", "mikkeos_test")
  .eq("source_record_id", sourceRecordId)
  .single();

if (selectError || !selected) {
  fail("Select after insert failed.", selectError);
}

const storyVisible = selected.visibility === "public" && selected.display_on_story === true;
const deskCounted =
  selected.has_financial_value === true &&
  selected.amount !== null &&
  ["revenue", "expense"].includes(selected.transaction_type);
const summaryCounted = selected.counts_toward_summary === true;

const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const { data: publicSelected, error: publicSelectError } = await anonClient
  .from("activity_logs")
  .select("id,source_service,source_record_id,visibility,display_on_story,counts_toward_summary,has_financial_value")
  .eq("source_service", "mikkeos_test")
  .eq("source_record_id", sourceRecordId)
  .maybeSingle();

if (publicSelectError) {
  fail("Public policy select verification failed.", publicSelectError);
}

let deleteResult = { attempted: false };
if (shouldDelete) {
  const { error: deleteError } = await supabase
    .from("activity_logs")
    .delete()
    .eq("source_service", "mikkeos_test")
    .eq("source_record_id", sourceRecordId);

  if (deleteError) {
    fail("Delete verification failed.", deleteError);
  }

  deleteResult = { attempted: true, ok: true };
}

console.log(
  JSON.stringify(
    {
      ok: true,
      scenario: scenario.key,
      user: { id: user.id },
      profile: { id: profile.id, user_id: profile.user_id },
      payload,
      insert: {
        ok: true,
        id: inserted.id,
        source_record_id: inserted.source_record_id
      },
      select: {
        ok: true,
        row: selected
      },
      story: {
        visible: storyVisible,
        public_policy_readable: Boolean(publicSelected),
        expected_public_policy_readable: scenario.expectsPublicRead,
        reason: scenario.storyReason
      },
      desk: {
        counted: deskCounted,
        expected_counted: scenario.expectsDeskCount,
        reason: scenario.deskReason
      },
      summary: {
        counted: summaryCounted,
        expected_counted: scenario.expectsSummaryCount,
        reason: scenario.summaryReason
      },
      delete: deleteResult
    },
    null,
    2
  )
);

function getScenario(rawKey) {
  const scenarios = {
    safe_private: {
      key: "safe_private",
      activityType: "mikkeos_safe_insert_test",
      category: "other",
      title: "mikkeOS safe private insert test",
      description: "Private adapter-path safety test. Not for Story, DESK, or summary.",
      visibility: "private",
      status: "completed",
      displayOnStory: false,
      countsTowardSummary: false,
      hasFinancialValue: false,
      amount: null,
      transactionType: "none",
      paymentStatus: "not_required",
      expectsPublicRead: false,
      expectsDeskCount: false,
      expectsSummaryCount: false,
      storyReason: "visibility is private and display_on_story is false",
      deskReason: "has_financial_value is false, amount is null, and transaction_type is none",
      summaryReason: "counts_toward_summary is false"
    },
    private_revenue: {
      key: "private_revenue",
      activityType: "mikkeos_private_revenue_test",
      category: "other",
      title: "mikkeOS private revenue test",
      description: "Private revenue adapter-path test. For DESK only, not Story or summary.",
      visibility: "private",
      status: "completed",
      displayOnStory: false,
      countsTowardSummary: false,
      hasFinancialValue: true,
      amount: 1000,
      transactionType: "revenue",
      paymentStatus: "paid",
      expectsPublicRead: false,
      expectsDeskCount: true,
      expectsSummaryCount: false,
      storyReason: "private financial logs must not be public Story targets",
      deskReason: "has_financial_value is true, amount is present, and transaction_type is revenue",
      summaryReason: "revenue logs are DESK records and should not inflate activity achievements"
    },
    public_story: {
      key: "public_story",
      activityType: "mikkeos_public_story_test",
      category: "other",
      title: "mikkeOS public Story test",
      description: "Public Story adapter-path test. Non-financial and counted toward summary.",
      visibility: "public",
      status: "completed",
      displayOnStory: true,
      countsTowardSummary: true,
      hasFinancialValue: false,
      amount: null,
      transactionType: "none",
      paymentStatus: "not_required",
      expectsPublicRead: true,
      expectsDeskCount: false,
      expectsSummaryCount: true,
      storyReason: "visibility is public and display_on_story is true",
      deskReason: "public Story test is non-financial",
      summaryReason: "counts_toward_summary is true for an activity achievement"
    }
  };

  const normalizedKey = rawKey.replace(/-/g, "_");
  const found = scenarios[normalizedKey];
  if (found) return found;

  fail(`Unknown MIKKEOS test scenario: ${rawKey}.`, {
    message: `Use one of: ${Object.keys(scenarios).join(", ")}`
  });
}

function readEnvFile(path) {
  const result = {};
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    result[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function fail(message, error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        error: error
          ? {
              name: error.name,
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            }
          : null
      },
      null,
      2
    )
  );
  process.exit(1);
}
