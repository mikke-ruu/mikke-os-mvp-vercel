import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Community,
  CommunityComment,
  CommunityDashboard,
  CommunityEntitlementDefinition,
  CommunityEvent,
  CommunityMemberEntitlement,
  CommunityMemberProfile,
  CommunityMembership,
  CommunityMembershipStatus,
  CommunityPost,
  CommunityPostAttachment,
  CommunityPostKind,
  CommunityPublicEntry,
  CommunityResource,
  CommunityResourceKind,
  CommunityRole,
  CommunityRoom,
  CommunityRoomAccessType,
  CommunityRoomColor,
  CommunityRoomKind,
  CommunityStamp
} from "./types";
import { assertMikkeNameIsNotReserved } from "@/lib/mikkeos/reserved-names";

type DbClient = SupabaseClient<any, "public", any>;

function mapCommunity(row: any): Community {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    joinMode: row.join_mode,
    status: row.status,
    ownerUserId: row.owner_user_id ?? null,
    logoUrl: row.logo_url ?? null,
    bannerUrl: row.banner_url ?? null
  };
}

function mapMembership(row: any): CommunityMembership {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    memo: row.memo ?? null
  };
}

function mapProfile(row: any): CommunityMemberProfile {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null
  };
}

function mapEntitlementDefinition(row: any): CommunityEntitlementDefinition {
  return {
    id: row.id,
    communityId: row.community_id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    status: row.status
  };
}

function mapMemberEntitlement(row: any): CommunityMemberEntitlement {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    entitlementKey: row.entitlement_key,
    source: row.source,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null
  };
}

function mapRoom(row: any, requiredEntitlementKeys: string[], isLocked: boolean): CommunityRoom {
  return {
    id: row.id,
    communityId: row.community_id,
    title: row.title,
    description: row.description ?? null,
    kind: row.kind,
    accessType: row.access_type ?? "free",
    themeColor: row.theme_color ?? "yellow",
    requiredEntitlementKeys,
    isLocked,
    sortOrder: row.sort_order ?? 0,
    isArchived: Boolean(row.is_archived),
    memberCanPost: Boolean(row.member_can_post),
    memberCanComment: Boolean(row.member_can_comment)
  };
}

function mapComment(row: any): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorUserId: row.author_user_id,
    body: row.body,
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stampId: row.stamp_id ?? null,
    stamp: null,
    profile: null
  };
}

function mapPost(row: any): CommunityPost {
  return {
    id: row.id,
    communityId: row.community_id,
    roomId: row.room_id,
    authorUserId: row.author_user_id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    url: row.url ?? null,
    imageUrl: row.image_url ?? null,
    isPinned: Boolean(row.is_pinned),
    isHidden: Boolean(row.is_hidden),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    room: row.community_rooms
      ? { id: row.community_rooms.id, title: row.community_rooms.title, kind: row.community_rooms.kind }
      : null,
    profile: null,
    comments: [],
    attachments: []
  };
}

function mapAttachment(row: any): CommunityPostAttachment {
  return {
    id: row.id,
    communityId: row.community_id,
    postId: row.post_id,
    uploaderUserId: row.uploader_user_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    createdAt: row.created_at
  };
}

function mapStamp(row: any): CommunityStamp {
  return {
    id: row.id,
    communityId: row.community_id,
    name: row.name,
    imageUrl: row.image_url,
    sortOrder: row.sort_order ?? 100,
    isActive: Boolean(row.is_active),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEvent(row: any): CommunityEvent {
  return {
    id: row.id,
    communityId: row.community_id,
    title: row.title,
    description: row.description ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null,
    locationLabel: row.location_label ?? null,
    externalUrl: row.external_url ?? null,
    status: row.status,
    sortOrder: row.sort_order ?? 0,
    attendeeStatus: row.community_event_attendees?.[0]?.status ?? null
  };
}

function mapResource(row: any): CommunityResource {
  return {
    id: row.id,
    communityId: row.community_id,
    title: row.title,
    description: row.description ?? null,
    kind: row.kind,
    externalUrl: row.external_url,
    isPublished: Boolean(row.is_published),
    sortOrder: row.sort_order ?? 0,
    publishedAt: row.published_at ?? null
  };
}

export function communityErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  if (message.includes("relation") || message.includes("permission denied") || message.includes("column")) {
    return "COMMUNITYのデータベース更新が必要です。最新migrationの適用後にもう一度お試しください。";
  }
  return message || fallback;
}

export async function loadCommunityPublicEntry(client: DbClient, communitySlug: string): Promise<CommunityPublicEntry> {
  const { data, error } = await client
    .from("community_communities")
    .select("slug,name,description,join_mode,status,logo_url,banner_url")
    .eq("slug", communitySlug)
    .eq("status", "active")
    .single();
  if (error) throw error;
  return {
    slug: data.slug,
    name: data.name,
    description: data.description ?? null,
    joinMode: data.join_mode,
    status: data.status,
    logoUrl: data.logo_url ?? null,
    bannerUrl: data.banner_url ?? null
  };
}

export async function listMyCommunities(client: DbClient, userId: string): Promise<Community[]> {
  const { data: memberships, error: membershipsError } = await client
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", userId)
    .eq("status", "active");
  if (membershipsError) throw membershipsError;
  const ids = Array.from(new Set((memberships ?? []).map((item: any) => item.community_id)));
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("community_communities")
    .select("*")
    .in("id", ids)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCommunity);
}

export async function listMyManagedCommunities(client: DbClient, userId: string): Promise<Community[]> {
  const { data: memberships, error: membershipsError } = await client
    .from("community_memberships")
    .select("community_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "moderator"]);
  if (membershipsError) throw membershipsError;
  const ids = Array.from(new Set((memberships ?? []).map((item: any) => item.community_id)));
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("community_communities")
    .select("*")
    .in("id", ids)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCommunity);
}

export async function createCommunity(client: DbClient, userId: string, input: { name: string; slug: string; description: string; displayName: string }): Promise<Community> {
  if (!userId) throw new Error("ログインが必要です。");
  assertMikkeNameIsNotReserved({ slug: input.slug, displayName: input.name, label: "Community名またはURL用ID" });
  const { data, error } = await client.rpc("community_create", {
    p_name: input.name.trim(),
    p_slug: input.slug.trim().toLowerCase(),
    p_description: input.description.trim() || null,
    p_display_name: input.displayName.trim() || null
  });
  if (error) throw error;
  return mapCommunity(Array.isArray(data) ? data[0] : data);
}

function isCurrentlyActive(entitlement: CommunityMemberEntitlement) {
  const now = Date.now();
  return entitlement.status === "active"
    && new Date(entitlement.startsAt).getTime() <= now
    && (!entitlement.endsAt || new Date(entitlement.endsAt).getTime() > now);
}

export async function loadCommunityDashboard(client: DbClient, userId: string, communitySlug: string): Promise<CommunityDashboard> {
  const { data: communityRow, error: communityError } = await client
    .from("community_communities")
    .select("*")
    .eq("slug", communitySlug)
    .eq("status", "active")
    .single();
  if (communityError) throw communityError;

  const community = mapCommunity(communityRow);
  const [membershipResult, membershipsResult, profilesResult, roomRulesResult, definitionsResult, grantsResult, stampsResult] = await Promise.all([
    client.from("community_memberships").select("*").eq("community_id", community.id).eq("user_id", userId).maybeSingle(),
    client.from("community_memberships").select("*").eq("community_id", community.id).order("joined_at", { ascending: true }),
    client.from("community_member_profiles").select("*").eq("community_id", community.id),
    client.from("community_room_entitlement_rules").select("room_id,entitlement_key").eq("community_id", community.id),
    client.from("community_entitlement_definitions").select("*").eq("community_id", community.id).eq("status", "active").order("name", { ascending: true }),
    client.from("community_member_entitlements").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
    client.from("community_stamps").select("*").eq("community_id", community.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true })
  ]);

  const firstError = [membershipResult, membershipsResult, profilesResult, roomRulesResult, definitionsResult, grantsResult, stampsResult]
    .find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const membership = membershipResult.data ? mapMembership(membershipResult.data) : null;
  const allGrants = (grantsResult.data ?? []).map(mapMemberEntitlement);
  const ownEntitlements = allGrants.filter((item) => item.userId === userId);
  const activeKeys = new Set(ownEntitlements.filter(isCurrentlyActive).map((item) => item.entitlementKey));
  const staff = community.ownerUserId === userId || membership?.role === "owner" || membership?.role === "moderator";

  let roomsQuery = client.from("community_rooms").select("*").eq("community_id", community.id).order("is_archived", { ascending: true }).order("sort_order", { ascending: true });
  if (!staff) roomsQuery = roomsQuery.eq("is_archived", false);
  let postsQuery = client.from("community_posts").select("*, community_rooms(id,title,kind)").eq("community_id", community.id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  if (!staff) postsQuery = postsQuery.eq("is_hidden", false);
  let eventsQuery = client.from("community_events").select("*, community_event_attendees(status)").eq("community_id", community.id).order("starts_at", { ascending: true }).limit(20);
  if (!staff) eventsQuery = eventsQuery.neq("status", "cancelled");
  let resourcesQuery = client.from("community_resources").select("*").eq("community_id", community.id).order("sort_order", { ascending: true });
  if (!staff) resourcesQuery = resourcesQuery.eq("is_published", true);
  const [roomsResult, postsResult, eventsResult, resourcesResult] = await Promise.all([roomsQuery, postsQuery, eventsQuery, resourcesQuery]);
  const contentError = [roomsResult, postsResult, eventsResult, resourcesResult].find((result) => result.error)?.error;
  if (contentError) throw contentError;

  const roomRules = new Map<string, string[]>();
  for (const row of roomRulesResult.data ?? []) {
    roomRules.set(row.room_id, [...(roomRules.get(row.room_id) ?? []), row.entitlement_key]);
  }
  const rooms = (roomsResult.data ?? []).map((row: any) => {
    const keys = roomRules.get(row.id) ?? [];
    const accessType = (row.access_type ?? "free") as CommunityRoomAccessType;
    const locked = accessType === "staff"
      ? !staff
      : accessType === "entitlement" && !staff && (keys.length === 0 || !keys.some((key) => activeKeys.has(key)));
    return mapRoom(row, keys, locked);
  });

  const posts = (postsResult.data ?? []).map(mapPost);
  const postIds = posts.map((post) => post.id);
  const [commentsResult, attachmentsResult] = postIds.length > 0
    ? await Promise.all([
        client.from("community_comments").select("*").in("post_id", postIds).eq("is_hidden", false).order("created_at", { ascending: true }),
        client.from("community_post_attachments").select("*").in("post_id", postIds).order("created_at", { ascending: true })
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (commentsResult.error) throw commentsResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  const profiles = (profilesResult.data ?? []).map(mapProfile);
  const profilesByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const stamps = (stampsResult.data ?? []).map(mapStamp);
  const stampsById = new Map(stamps.map((stamp) => [stamp.id, stamp]));
  const comments = (commentsResult.data ?? []).map(mapComment);
  const attachments = (attachmentsResult.data ?? []).map(mapAttachment);
  const commentsByPost = new Map<string, CommunityComment[]>();
  const attachmentsByPost = new Map<string, CommunityPostAttachment[]>();
  for (const comment of comments) {
    comment.profile = profilesByUser.get(comment.authorUserId) ?? null;
    comment.stamp = comment.stampId ? stampsById.get(comment.stampId) ?? null : null;
    commentsByPost.set(comment.postId, [...(commentsByPost.get(comment.postId) ?? []), comment]);
  }
  for (const attachment of attachments) {
    attachmentsByPost.set(attachment.postId, [...(attachmentsByPost.get(attachment.postId) ?? []), attachment]);
  }
  for (const post of posts) {
    post.profile = profilesByUser.get(post.authorUserId) ?? null;
    post.comments = commentsByPost.get(post.id) ?? [];
    post.attachments = attachmentsByPost.get(post.id) ?? [];
  }

  const allMemberships = (membershipsResult.data ?? []).map(mapMembership);
  const ownerMembers = staff
    ? allMemberships.map((item) => ({
        membership: item,
        profile: profilesByUser.get(item.userId) ?? null,
        entitlements: allGrants.filter((grant) => grant.userId === item.userId)
      }))
    : [];

  return {
    community,
    membership,
    profile: profilesByUser.get(userId) ?? null,
    entitlements: ownEntitlements,
    entitlementDefinitions: (definitionsResult.data ?? []).map(mapEntitlementDefinition),
    ownerMembers,
    rooms,
    posts,
    events: (eventsResult.data ?? []).map(mapEvent),
    resources: (resourcesResult.data ?? []).map(mapResource),
    stamps
  };
}

export async function joinCommunity(client: DbClient, communityId: string, userId: string, displayName: string, email?: string) {
  const safeDisplayName = displayName.trim() || email?.split("@")[0] || "COMMUNITY participant";
  const { data: community, error: communityError } = await client
    .from("community_communities")
    .select("join_mode,status")
    .eq("id", communityId)
    .single();
  if (communityError) throw communityError;
  if (community?.status !== "active") throw new Error("このCOMMUNITYは現在参加できません。");
  if (community?.join_mode !== "open_free") throw new Error("このCOMMUNITYは現在、無料の自由参加を受け付けていません。");

  const { data: existingMembership, error: existingMembershipError } = await client
    .from("community_memberships")
    .select("id,status")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingMembershipError) throw existingMembershipError;
  if (existingMembership?.status === "suspended") throw new Error("このCOMMUNITYへの参加は一時停止されています。運営にお問い合わせください。");

  const membershipMutation = existingMembership
    ? client.from("community_memberships").update({ status: "active" }).eq("id", existingMembership.id)
    : client.from("community_memberships").insert({ community_id: communityId, user_id: userId, role: "member", status: "active" });
  const { error: membershipError } = await membershipMutation;
  if (membershipError) throw membershipError;

  const { error: profileError } = await client.from("community_member_profiles").upsert(
    { community_id: communityId, user_id: userId, display_name: safeDisplayName },
    { onConflict: "community_id,user_id" }
  );
  if (profileError) throw profileError;
}

export async function claimCommunityOwnership(client: DbClient, communityId: string, userId: string) {
  const { error } = await client.from("community_communities").update({ owner_user_id: userId }).eq("id", communityId).is("owner_user_id", null);
  if (error) throw error;
}

export async function saveCommunitySettings(client: DbClient, communityId: string, input: { name: string; description: string; joinMode: Community["joinMode"]; logoUrl?: string | null; bannerUrl?: string | null }) {
  const { error } = await client.from("community_communities").update({
    name: input.name.trim(),
    description: input.description.trim() || null,
    join_mode: input.joinMode,
    ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl } : {}),
    ...(input.bannerUrl !== undefined ? { banner_url: input.bannerUrl } : {})
  }).eq("id", communityId);
  if (error) throw error;
}

export async function saveCommunityProfile(client: DbClient, communityId: string, userId: string, displayName: string, bio: string, avatarUrl?: string | null) {
  const { error } = await client.from("community_member_profiles").upsert(
    { community_id: communityId, user_id: userId, display_name: displayName.trim() || "COMMUNITY participant", bio: bio.trim() || null, ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}) },
    { onConflict: "community_id,user_id" }
  );
  if (error) throw error;
}

export async function createCommunityRoom(client: DbClient, communityId: string, input: { title: string; description: string; kind: CommunityRoomKind; accessType: CommunityRoomAccessType; themeColor: CommunityRoomColor; entitlementKey?: string }) {
  const { data, error } = await client.from("community_rooms").insert({
    community_id: communityId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    kind: input.kind,
    access_type: input.accessType,
    theme_color: input.themeColor,
    member_can_post: input.kind !== "announcement",
    member_can_comment: true,
    sort_order: 100
  }).select("id").single();
  if (error) throw error;
  if (input.accessType === "entitlement" && input.entitlementKey) {
    const { error: ruleError } = await client.from("community_room_entitlement_rules").insert({ community_id: communityId, room_id: data.id, entitlement_key: input.entitlementKey });
    if (ruleError) throw ruleError;
  }
}

export async function updateCommunityRoomAccess(client: DbClient, roomId: string, communityId: string, accessType: CommunityRoomAccessType, entitlementKey?: string) {
  const { error: roomError } = await client.from("community_rooms").update({ access_type: accessType }).eq("id", roomId).eq("community_id", communityId);
  if (roomError) throw roomError;
  const { error: deleteError } = await client.from("community_room_entitlement_rules").delete().eq("room_id", roomId);
  if (deleteError) throw deleteError;
  if (accessType === "entitlement" && entitlementKey) {
    const { error: ruleError } = await client.from("community_room_entitlement_rules").insert({ community_id: communityId, room_id: roomId, entitlement_key: entitlementKey });
    if (ruleError) throw ruleError;
  }
}

export async function updateCommunityRoom(client: DbClient, roomId: string, communityId: string, input: { title: string; description: string; kind: CommunityRoomKind; themeColor: CommunityRoomColor; sortOrder: number; memberCanPost: boolean; memberCanComment: boolean }) {
  const { error } = await client.from("community_rooms").update({
    title: input.title.trim(),
    description: input.description.trim() || null,
    kind: input.kind,
    theme_color: input.themeColor,
    sort_order: input.sortOrder,
    member_can_post: input.memberCanPost,
    member_can_comment: input.memberCanComment
  }).eq("id", roomId).eq("community_id", communityId);
  if (error) throw error;
}

export async function archiveCommunityRoom(client: DbClient, roomId: string, communityId: string) {
  const { error } = await client.from("community_rooms").update({ is_archived: true }).eq("id", roomId).eq("community_id", communityId);
  if (error) throw error;
}

export async function restoreCommunityRoom(client: DbClient, roomId: string, communityId: string) {
  const { error } = await client.from("community_rooms").update({ is_archived: false }).eq("id", roomId).eq("community_id", communityId);
  if (error) throw error;
}

export async function createEntitlementDefinition(client: DbClient, communityId: string, input: { key: string; name: string; description?: string }) {
  const normalizedKey = input.key.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
  const { error } = await client.from("community_entitlement_definitions").insert({
    community_id: communityId,
    key: normalizedKey,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: "active"
  });
  if (error) throw error;
}

export async function grantMemberEntitlement(client: DbClient, communityId: string, userId: string, entitlementKey: string, grantedByUserId: string) {
  const { error } = await client.from("community_member_entitlements").upsert({
    community_id: communityId,
    user_id: userId,
    entitlement_key: entitlementKey,
    source: "manual",
    status: "active",
    starts_at: new Date().toISOString(),
    ends_at: null,
    granted_by_user_id: grantedByUserId
  }, { onConflict: "community_id,user_id,entitlement_key,source" });
  if (error) throw error;
}

export async function revokeMemberEntitlement(client: DbClient, entitlementId: string) {
  const { error } = await client.from("community_member_entitlements").update({ status: "revoked" }).eq("id", entitlementId).eq("source", "manual");
  if (error) throw error;
}

export async function updateCommunityMembership(client: DbClient, membershipId: string, input: { role?: CommunityRole; status?: CommunityMembershipStatus }) {
  const patch: Partial<{ role: CommunityRole; status: CommunityMembershipStatus }> = {};
  if (input.role) patch.role = input.role;
  if (input.status) patch.status = input.status;
  if (Object.keys(patch).length === 0) return;
  const { error } = await client.from("community_memberships").update(patch).eq("id", membershipId);
  if (error) throw error;
}

export async function createCommunityPost(client: DbClient, input: { communityId: string; roomId: string; authorUserId: string; title: string; body: string; kind: CommunityPostKind; url?: string; imageUrl?: string; isPinned?: boolean }) {
  const { data, error } = await client.from("community_posts").insert({
    community_id: input.communityId,
    room_id: input.roomId,
    author_user_id: input.authorUserId,
    title: input.title.trim(),
    body: input.body.trim(),
    kind: input.kind,
    url: input.url?.trim() || null,
    image_url: input.imageUrl?.trim() || null,
    is_pinned: Boolean(input.isPinned)
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCommunityPostVisibility(client: DbClient, postId: string, input: { isHidden?: boolean; isPinned?: boolean }) {
  const patch: Record<string, boolean> = {};
  if (typeof input.isHidden === "boolean") patch.is_hidden = input.isHidden;
  if (typeof input.isPinned === "boolean") patch.is_pinned = input.isPinned;
  if (Object.keys(patch).length === 0) return;
  const { error } = await client.from("community_posts").update(patch).eq("id", postId);
  if (error) throw error;
}

export async function updateCommunityPost(client: DbClient, postId: string, input: { title: string; body: string; url?: string; isPinned: boolean }) {
  const { error } = await client.from("community_posts").update({
    title: input.title.trim(),
    body: input.body.trim(),
    url: input.url?.trim() || null,
    is_pinned: input.isPinned
  }).eq("id", postId);
  if (error) throw error;
}

export async function deleteCommunityPost(client: DbClient, postId: string, authorUserId: string) {
  const { error } = await client.from("community_posts").update({ deleted_at: new Date().toISOString(), deleted_by_user_id: authorUserId }).eq("id", postId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export async function createCommunityComment(client: DbClient, postId: string, authorUserId: string, body: string, stampId?: string) {
  const { error } = await client.from("community_comments").insert({ post_id: postId, author_user_id: authorUserId, body: body.trim() || "スタンプ", stamp_id: stampId ?? null });
  if (error) throw error;
}

export async function updateCommunityComment(client: DbClient, commentId: string, authorUserId: string, body: string) {
  const { error } = await client.from("community_comments").update({ body: body.trim() }).eq("id", commentId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export async function deleteCommunityComment(client: DbClient, commentId: string, authorUserId: string) {
  const { error } = await client.from("community_comments").update({ deleted_at: new Date().toISOString(), deleted_by_user_id: authorUserId }).eq("id", commentId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export const COMMUNITY_FILE_BUCKET = "community-files";
export const COMMUNITY_FILE_MAX_BYTES = 10 * 1024 * 1024;

const communityFileMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const communityFileMimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export async function uploadCommunityPostAttachment(client: DbClient, input: { communityId: string; postId: string; userId: string; file: File }): Promise<CommunityPostAttachment> {
  if (input.file.size <= 0 || input.file.size > COMMUNITY_FILE_MAX_BYTES) throw new Error("添付ファイルは10MB以下にしてください。");
  const rawExtension = input.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const extension = rawExtension.slice(0, 10) || "file";
  const mimeType = communityFileMimeTypes.has(input.file.type) ? input.file.type : communityFileMimeByExtension[extension];
  if (!mimeType) throw new Error("このファイル形式は添付できません。PDF、Office、テキスト、ZIP、画像を選んでください。");
  const storagePath = `${input.communityId}/${input.postId}/${input.userId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await client.from("community_post_attachments").insert({
    community_id: input.communityId,
    post_id: input.postId,
    uploader_user_id: input.userId,
    storage_path: storagePath,
    file_name: input.file.name.slice(0, 255),
    mime_type: mimeType,
    byte_size: input.file.size
  }).select("*").single();
  if (error) throw error;

  const { error: uploadError } = await client.storage.from(COMMUNITY_FILE_BUCKET).upload(storagePath, input.file, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: false
  });
  if (uploadError) {
    await client.from("community_post_attachments").delete().eq("id", data.id);
    throw uploadError;
  }
  return mapAttachment(data);
}

export async function createCommunityAttachmentDownloadUrl(client: DbClient, storagePath: string) {
  const { data, error } = await client.storage.from(COMMUNITY_FILE_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function createCommunityStamp(client: DbClient, input: { communityId: string; userId: string; name: string; imageUrl: string }) {
  const { data, error } = await client.from("community_stamps").insert({
    community_id: input.communityId,
    created_by_user_id: input.userId,
    name: input.name.trim(),
    image_url: input.imageUrl,
    sort_order: 100,
    is_active: true
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function setCommunityStampActive(client: DbClient, stampId: string, isActive: boolean) {
  const { error } = await client.from("community_stamps").update({ is_active: isActive }).eq("id", stampId);
  if (error) throw error;
}

export async function reorderCommunityRooms(client: DbClient, communityId: string, roomIds: string[]) {
  const results = await Promise.all(roomIds.map((roomId, index) => (
    client.from("community_rooms").update({ sort_order: (index + 1) * 10 }).eq("id", roomId).eq("community_id", communityId)
  )));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function createCommunityEvent(client: DbClient, communityId: string, input: { title: string; description: string; startsAt: string; endsAt?: string; locationLabel?: string; externalUrl?: string }) {
  const { error } = await client.from("community_events").insert({
    community_id: communityId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    location_label: input.locationLabel?.trim() || null,
    external_url: input.externalUrl?.trim() || null,
    status: "open"
  });
  if (error) throw error;
}

export async function updateCommunityEventStatus(client: DbClient, eventId: string, status: "open" | "closed" | "cancelled") {
  const { error } = await client.from("community_events").update({ status }).eq("id", eventId);
  if (error) throw error;
}

export async function updateCommunityEvent(client: DbClient, eventId: string, input: { title: string; description: string; startsAt: string; endsAt?: string; locationLabel?: string; externalUrl?: string; status: "open" | "closed" | "cancelled" }) {
  const { error } = await client.from("community_events").update({
    title: input.title.trim(),
    description: input.description.trim() || null,
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    location_label: input.locationLabel?.trim() || null,
    external_url: input.externalUrl?.trim() || null,
    status: input.status
  }).eq("id", eventId);
  if (error) throw error;
}

export async function setEventAttendance(client: DbClient, eventId: string, userId: string, status: "going" | "cancelled") {
  const { error } = await client.from("community_event_attendees").upsert({ event_id: eventId, user_id: userId, status }, { onConflict: "event_id,user_id" });
  if (error) throw error;
}

export async function createCommunityResource(client: DbClient, communityId: string, input: { title: string; description: string; kind: CommunityResourceKind; externalUrl: string }) {
  const { error } = await client.from("community_resources").insert({
    community_id: communityId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    kind: input.kind,
    external_url: input.externalUrl.trim(),
    is_published: true,
    published_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function updateCommunityResourceVisibility(client: DbClient, resourceId: string, isPublished: boolean) {
  const { error } = await client.from("community_resources").update({
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null
  }).eq("id", resourceId);
  if (error) throw error;
}

export async function updateCommunityResource(client: DbClient, resourceId: string, input: { title: string; description: string; kind: CommunityResourceKind; externalUrl: string; isPublished: boolean }) {
  const { error } = await client.from("community_resources").update({
    title: input.title.trim(),
    description: input.description.trim() || null,
    kind: input.kind,
    external_url: input.externalUrl.trim(),
    is_published: input.isPublished,
    published_at: input.isPublished ? new Date().toISOString() : null
  }).eq("id", resourceId);
  if (error) throw error;
}
