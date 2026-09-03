import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260901130000_community_guarded_platform_creation.sql", "utf8");
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const has = (pattern, label) => check(pattern.test(migration), label);

has(/security definer\s+set search_path = ''/i, "definer has empty path");
has(/auth\.uid\(\)/, "actor comes from auth uid");
has(/auth\.jwt\(\) ->> 'is_anonymous'/, "anonymous Auth rejected");
has(/from platform_billing_private\.creation_entitlements[\s\S]*for update/i, "entitlement locked first");
has(/actor_user_id = v_actor/, "owner matched");
has(/product_key = 'community_platform'/, "product matched");
has(/resource_id is null/, "unbound matched");
has(/status = 'available'/, "available matched");
has(/starts_at > v_now/, "future start rejected");
has(/expires_at is not null and v_entitlement\.expires_at <= v_now/, "expiry rejected");
has(/insert into public\.community_communities[\s\S]*update platform_billing_private\.creation_entitlements/i, "create precedes consume in one function");
has(/set status = 'consumed', resource_id = v_community\.id/, "grant bound and consumed");
has(/raise exception 'COMMUNITY_CREATE_ENTITLEMENT_CONFLICT' using errcode = '40001'/, "stable conflict");
has(/revoke all on function public\.community_create_with_platform_entitlement[\s\S]*from public, anon/i, "new RPC narrowed");
has(/grant execute on function public\.community_create_with_platform_entitlement[\s\S]*to authenticated/i, "authenticated RPC granted");
has(/revoke all on function public\.community_create\(text,text,text,text\)[\s\S]*from authenticated/i, "legacy bypass revoked");
check(!/grant execute on function public\.community_create\(text,text,text,text\)[\s\S]*to authenticated/i.test(migration), "legacy grant not restored");
check(!/manual|subscription|academy.*claim/i.test(migration), "unrelated rights untouched");
console.log(`community-guarded-creation-check: ${checks} static checks passed`);
