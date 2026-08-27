import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Community,
  CommunityActivity,
  CommunityChatMessage,
  CommunityComment,
  CommunityConversationMode,
  CommunityDashboard,
  CommunityEntitlementDefinition,
  CommunityEvent,
  CommunityHomeMetric,
  CommunityBlockedWord,
  CommunityInquiry,
  CommunityInquiryStatus,
  CommunityInvitation,
  CommunityJoinApplication,
  CommunityMemberDataRequest,
  CommunityMemberEntitlement,
  CommunityMemberProfile,
  CommunityMembership,
  CommunityMembershipPlan,
  CommunityMembershipStatus,
  CommunityOperatorProfile,
  CommunityPaymentClaim,
  CommunityPost,
  CommunityPostAttachment,
  CommunityPostKind,
  CommunityPublicEntry,
  CommunityResource,
  CommunityResourceKind,
  CommunityRole,
  CommunityReport,
  CommunityReportStatus,
  CommunityRoom,
  CommunityRoomAccessType,
  CommunityRoomColor,
  CommunityRoomKind,
  CommunitySearchResult,
  CommunitySafetySettings,
  CommunityAcademyAccessInvitation,
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
    bannerUrl: row.banner_url ?? null,
    homeMetrics: [
      row.home_metric_1 ?? "unread",
      row.home_metric_2 ?? "today_activity",
      row.home_metric_3 ?? "upcoming_events"
    ]
  };
}

function mapMembership(row: any): CommunityMembership {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    accessScope: row.access_scope ?? "community",
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
    avatarUrl: row.avatar_url ?? null,
    avatarColor: row.avatar_color ?? "pink",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSafetySettings(row: any): CommunitySafetySettings {
  return {
    communityId: row.community_id,
    approvalMode: row.approval_mode,
    requireLegalName: Boolean(row.require_legal_name),
    requirePhone: Boolean(row.require_phone),
    requireJoinReason: Boolean(row.require_join_reason),
    termsVersion: row.terms_version,
    termsText: row.terms_text,
    rulesVersion: row.rules_version,
    rulesText: row.rules_text,
    privacyVersion: row.privacy_version,
    privacyText: row.privacy_text,
    newMemberLimitEnabled: Boolean(row.new_member_limit_enabled),
    newMemberLimitHours: row.new_member_limit_hours,
    newMemberMaxActions: row.new_member_max_actions
  };
}

function mapJoinApplication(row: any): CommunityJoinApplication {
  return {
    id: row.id, communityId: row.community_id, userId: row.user_id,
    displayName: row.display_name, legalName: row.legal_name ?? null,
    email: row.email, phone: row.phone ?? null, joinReason: row.join_reason ?? null,
    status: row.status, reviewNote: row.review_note ?? null,
    submittedAt: row.submitted_at, reviewedAt: row.reviewed_at ?? null
  };
}

function mapBlockedWord(row: any): CommunityBlockedWord {
  return { id: row.id, communityId: row.community_id, term: row.term, action: row.action, isActive: Boolean(row.is_active), createdAt: row.created_at };
}

function mapReport(row: any): CommunityReport {
  return { id: row.id, communityId: row.community_id, reporterUserId: row.reporter_user_id, targetType: row.target_type, targetId: row.target_id ?? null, reason: row.reason, details: row.details ?? null, status: row.status, resolutionNote: row.resolution_note ?? null, createdAt: row.created_at };
}

function mapInquiry(row: any): CommunityInquiry {
  return { id: row.id, communityId: row.community_id, userId: row.user_id, category: row.category, subject: row.subject, body: row.body, status: row.status, responseNote: row.response_note ?? null, createdAt: row.created_at };
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
    sourceReference: row.source_reference ?? null,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null
  };
}

function mapInvitation(row: any): CommunityInvitation {
  return {
    id: row.id, communityId: row.community_id, invitedUserId: row.invited_user_id,
    invitedByUserId: row.invited_by_user_id, invitedMikkeId: row.invited_mikke_id, entitlementKey: row.entitlement_key ?? null,
    status: row.status, expiresAt: row.expires_at ?? null, acceptedAt: row.accepted_at ?? null,
    createdAt: row.created_at
  };
}

function mapMembershipPlan(row: any): CommunityMembershipPlan {
  return {
    id: row.id, communityId: row.community_id, entitlementKey: row.entitlement_key,
    name: row.name, description: row.description ?? null, amountYen: row.amount_yen,
    billingInterval: row.billing_interval, paymentProviderLabel: row.payment_provider_label,
    externalPaymentUrl: row.external_payment_url, status: row.status, sortOrder: row.sort_order ?? 0
  };
}

function mapPaymentClaim(row: any): CommunityPaymentClaim {
  return {
    id: row.id, communityId: row.community_id, planId: row.plan_id, userId: row.user_id,
    payerName: row.payer_name, externalReference: row.external_reference ?? null, note: row.note ?? null,
    status: row.status, reviewNote: row.review_note ?? null, createdAt: row.created_at
  };
}

function mapDataRequest(row: any): CommunityMemberDataRequest {
  return {
    id: row.id, communityId: row.community_id, userId: row.user_id,
    requestType: row.request_type, status: row.status, memberNote: row.member_note ?? null,
    responseNote: row.response_note ?? null, createdAt: row.created_at
  };
}

function mapOperatorProfile(row: any): CommunityOperatorProfile {
  return {
    communityId: row.community_id, businessName: row.business_name,
    representativeName: row.representative_name, businessType: row.business_type,
    postalAddress: row.postal_address, contactEmail: row.contact_email,
    contactPhone: row.contact_phone ?? null, websiteUrl: row.website_url ?? null,
    commercialDisclosureUrl: row.commercial_disclosure_url ?? null,
    privacyPolicyUrl: row.privacy_policy_url ?? null, termsUrl: row.terms_url ?? null,
    status: row.status
  };
}

function mapRoom(row: any, requiredEntitlementKeys: string[], isLocked: boolean): CommunityRoom {
  return {
    id: row.id,
    communityId: row.community_id,
    title: row.title,
    description: row.description ?? null,
    kind: row.kind,
    conversationMode: row.conversation_mode ?? "thread",
    accessType: row.access_type ?? "free",
    themeColor: row.theme_color ?? "yellow",
    requiredEntitlementKeys,
    isLocked,
    sortOrder: row.sort_order ?? 0,
    isArchived: Boolean(row.is_archived),
    memberCanPost: Boolean(row.member_can_post),
    memberCanComment: Boolean(row.member_can_comment),
    unreadCount: 0,
    postCount: 0,
    commentCount: 0,
    messageCount: 0,
    recentSpeakerUserIds: [],
    speakerCount: 0
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
    profile: null,
    reactions: []
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
    attachments: [],
    reactions: [],
    bookmarkedByMe: false
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

function mapChatMessage(row: any): CommunityChatMessage {
  return {
    id: row.id,
    communityId: row.community_id,
    roomId: row.room_id,
    authorUserId: row.author_user_id,
    replyToMessageId: row.reply_to_message_id ?? null,
    stampId: row.stamp_id ?? null,
    body: row.body,
    isHidden: Boolean(row.is_hidden),
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile: null,
    replyTo: null,
    stamp: null,
    reactions: []
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
  const [membershipResult, membershipsResult, profilesResult, roomRulesResult, definitionsResult, grantsResult, stampsResult, roomReadsResult, postActivityResult, chatActivityResult, safetyResult, myApplicationResult] = await Promise.all([
    client.from("community_memberships").select("*").eq("community_id", community.id).eq("user_id", userId).maybeSingle(),
    client.from("community_memberships").select("*").eq("community_id", community.id).order("joined_at", { ascending: true }),
    client.from("community_member_profiles").select("*").eq("community_id", community.id),
    client.from("community_room_entitlement_rules").select("room_id,entitlement_key").eq("community_id", community.id),
    client.from("community_entitlement_definitions").select("*").eq("community_id", community.id).eq("status", "active").order("name", { ascending: true }),
    client.from("community_member_entitlements").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
    client.from("community_stamps").select("*").eq("community_id", community.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    client.from("community_room_reads").select("room_id,last_seen_at").eq("community_id", community.id).eq("user_id", userId),
    client.from("community_posts").select("id,room_id,author_user_id,created_at").eq("community_id", community.id).eq("is_hidden", false).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000),
    client.from("community_chat_messages").select("id,room_id,author_user_id,body,stamp_id,created_at").eq("community_id", community.id).eq("is_hidden", false).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000),
    client.from("community_safety_settings").select("*").eq("community_id", community.id).maybeSingle(),
    client.from("community_join_applications").select("*").eq("community_id", community.id).eq("user_id", userId).maybeSingle()
  ]);

  const firstError = [membershipResult, membershipsResult, profilesResult, roomRulesResult, definitionsResult, grantsResult, stampsResult, roomReadsResult, postActivityResult, chatActivityResult, safetyResult, myApplicationResult]
    .find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const membership = membershipResult.data ? mapMembership(membershipResult.data) : null;
  const allGrants = (grantsResult.data ?? []).map(mapMemberEntitlement);
  const ownEntitlements = allGrants.filter((item) => item.userId === userId);
  const activeKeys = new Set(ownEntitlements.filter(isCurrentlyActive).map((item) => item.entitlementKey));
  const staff = community.ownerUserId === userId || membership?.role === "owner" || membership?.role === "moderator";

  const [applicationsResult, blockedWordsResult, reportsResult, inquiriesResult] = staff
    ? await Promise.all([
        client.from("community_join_applications").select("*").eq("community_id", community.id).order("submitted_at", { ascending: false }),
        client.from("community_blocked_words").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
        client.from("community_reports").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
        client.from("community_inquiries").select("*").eq("community_id", community.id).order("created_at", { ascending: false })
      ])
    : [
        { data: [], error: null },
        membership?.status === "active" ? await client.from("community_blocked_words").select("*").eq("community_id", community.id).eq("is_active", true) : { data: [], error: null },
        membership?.status === "active" ? await client.from("community_reports").select("*").eq("community_id", community.id).eq("reporter_user_id", userId).order("created_at", { ascending: false }) : { data: [], error: null },
        membership?.status === "active" ? await client.from("community_inquiries").select("*").eq("community_id", community.id).eq("user_id", userId).order("created_at", { ascending: false }) : { data: [], error: null }
      ];
  const safetyError = [applicationsResult, blockedWordsResult, reportsResult, inquiriesResult].find((result) => result.error)?.error;
  if (safetyError) throw safetyError;

  const [invitationsResult, membershipPlansResult, paymentClaimsResult, dataRequestsResult, operatorProfileResult] = await Promise.all([
    client.from("community_invitations").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
    client.from("community_membership_plans").select("*").eq("community_id", community.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    client.from("community_payment_claims").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
    client.from("community_member_data_requests").select("*").eq("community_id", community.id).order("created_at", { ascending: false }),
    staff ? client.from("community_operator_profiles").select("*").eq("community_id", community.id).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  const commercialError = [invitationsResult, membershipPlansResult, paymentClaimsResult, dataRequestsResult, operatorProfileResult].find((result) => result.error)?.error;
  if (commercialError) throw commercialError;

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

  let posts = (postsResult.data ?? []).map(mapPost);
  const bookmarksResult = await client
    .from("community_post_bookmarks")
    .select("post_id")
    .eq("community_id", community.id)
    .eq("user_id", userId);
  if (bookmarksResult.error) throw bookmarksResult.error;
  const bookmarkedPostIds = new Set((bookmarksResult.data ?? []).map((row: any) => row.post_id));
  const loadedPostIds = new Set(posts.map((post) => post.id));
  const missingBookmarkedPostIds = [...bookmarkedPostIds].filter((postId) => !loadedPostIds.has(postId));
  if (missingBookmarkedPostIds.length > 0) {
    const missingPostsResult = await client
      .from("community_posts")
      .select("*, community_rooms(id,title,kind)")
      .in("id", missingBookmarkedPostIds)
      .eq("community_id", community.id)
      .eq("is_hidden", false)
      .is("deleted_at", null);
    if (missingPostsResult.error) throw missingPostsResult.error;
    posts = [...posts, ...(missingPostsResult.data ?? []).map(mapPost)];
  }
  const postIds = posts.map((post) => post.id);
  const [commentsResult, attachmentsResult, postReactionsResult] = postIds.length > 0
    ? await Promise.all([
        client.from("community_comments").select("*").in("post_id", postIds).eq("is_hidden", false).is("deleted_at", null).order("created_at", { ascending: true }),
        client.from("community_post_attachments").select("*").in("post_id", postIds).order("created_at", { ascending: true }),
        client.from("community_post_reactions").select("post_id,user_id,emoji").in("post_id", postIds)
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if (commentsResult.error) throw commentsResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;
  if (postReactionsResult.error) throw postReactionsResult.error;

  const profiles = (profilesResult.data ?? []).map(mapProfile);
  const profilesByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const stamps = (stampsResult.data ?? []).map(mapStamp);
  const stampsById = new Map(stamps.map((stamp) => [stamp.id, stamp]));
  const comments = (commentsResult.data ?? []).map(mapComment);
  const attachments = (attachmentsResult.data ?? []).map(mapAttachment);
  const commentIds = comments.map((comment) => comment.id);
  const commentReactionsResult = commentIds.length > 0
    ? await client.from("community_comment_reactions").select("comment_id,user_id,emoji").in("comment_id", commentIds)
    : { data: [], error: null };
  if (commentReactionsResult.error) throw commentReactionsResult.error;
  const groupReactions = (rows: any[], targetKey: "post_id" | "comment_id") => {
    const grouped = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
    for (const row of rows) {
      const targetId = row[targetKey];
      const byEmoji = grouped.get(targetId) ?? new Map<string, { count: number; reactedByMe: boolean }>();
      const current = byEmoji.get(row.emoji) ?? { count: 0, reactedByMe: false };
      current.count += 1;
      if (row.user_id === userId) current.reactedByMe = true;
      byEmoji.set(row.emoji, current);
      grouped.set(targetId, byEmoji);
    }
    return new Map([...grouped.entries()].map(([targetId, byEmoji]) => [targetId, [...byEmoji.entries()].map(([emoji, value]) => ({ emoji, ...value }))]));
  };
  const postReactions = groupReactions(postReactionsResult.data ?? [], "post_id");
  const commentReactions = groupReactions(commentReactionsResult.data ?? [], "comment_id");
  const commentsByPost = new Map<string, CommunityComment[]>();
  const attachmentsByPost = new Map<string, CommunityPostAttachment[]>();
  for (const comment of comments) {
    comment.profile = profilesByUser.get(comment.authorUserId) ?? null;
    comment.stamp = comment.stampId ? stampsById.get(comment.stampId) ?? null : null;
    comment.reactions = commentReactions.get(comment.id) ?? [];
    commentsByPost.set(comment.postId, [...(commentsByPost.get(comment.postId) ?? []), comment]);
  }
  for (const attachment of attachments) {
    attachmentsByPost.set(attachment.postId, [...(attachmentsByPost.get(attachment.postId) ?? []), attachment]);
  }
  for (const post of posts) {
    post.profile = profilesByUser.get(post.authorUserId) ?? null;
    post.comments = commentsByPost.get(post.id) ?? [];
    post.attachments = attachmentsByPost.get(post.id) ?? [];
    post.reactions = postReactions.get(post.id) ?? [];
    post.bookmarkedByMe = bookmarkedPostIds.has(post.id);
  }

  const lastSeenByRoom = new Map<string, number>((roomReadsResult.data ?? []).map((row: any) => [row.room_id, new Date(row.last_seen_at).getTime()]));
  const fallbackSeenAt = membership?.joinedAt ? new Date(membership.joinedAt).getTime() : Date.now();
  const unreadByRoom = new Map<string, number>();
  const addUnread = (roomId: string, authorUserId: string, createdAt: string) => {
    if (authorUserId === userId) return;
    const lastSeenAt = lastSeenByRoom.get(roomId) ?? fallbackSeenAt;
    if (new Date(createdAt).getTime() > lastSeenAt) unreadByRoom.set(roomId, (unreadByRoom.get(roomId) ?? 0) + 1);
  };
  const postsById = new Map(posts.map((post) => [post.id, post]));
  for (const post of posts) addUnread(post.roomId, post.authorUserId, post.createdAt);
  for (const comment of comments) {
    const parentPost = postsById.get(comment.postId);
    if (parentPost) addUnread(parentPost.roomId, comment.authorUserId, comment.createdAt);
  }
  for (const activity of chatActivityResult.data ?? []) addUnread(activity.room_id, activity.author_user_id, activity.created_at);
  const roomStats = new Map<string, { postCount: number; commentCount: number; messageCount: number; speakers: Map<string, number> }>();
  const statsFor = (roomId: string) => {
    const current = roomStats.get(roomId) ?? { postCount: 0, commentCount: 0, messageCount: 0, speakers: new Map<string, number>() };
    roomStats.set(roomId, current);
    return current;
  };
  const rememberSpeaker = (roomId: string, authorUserId: string, createdAt: string) => {
    const speakers = statsFor(roomId).speakers;
    speakers.set(authorUserId, Math.max(speakers.get(authorUserId) ?? 0, new Date(createdAt).getTime()));
  };
  for (const post of postActivityResult.data ?? []) {
    statsFor(post.room_id).postCount += 1;
    rememberSpeaker(post.room_id, post.author_user_id, post.created_at);
  }
  for (const comment of comments) {
    const parentPost = postsById.get(comment.postId);
    if (!parentPost) continue;
    statsFor(parentPost.roomId).commentCount += 1;
    rememberSpeaker(parentPost.roomId, comment.authorUserId, comment.createdAt);
  }
  for (const message of chatActivityResult.data ?? []) {
    statsFor(message.room_id).messageCount += 1;
    rememberSpeaker(message.room_id, message.author_user_id, message.created_at);
  }
  for (const room of rooms) {
    const stats = statsFor(room.id);
    const speakers = [...stats.speakers.entries()].sort((left, right) => right[1] - left[1]);
    room.unreadCount = unreadByRoom.get(room.id) ?? 0;
    room.postCount = stats.postCount;
    room.commentCount = stats.commentCount;
    room.messageCount = stats.messageCount;
    room.recentSpeakerUserIds = speakers.slice(0, 5).map(([speakerId]) => speakerId);
    room.speakerCount = speakers.length;
  }

  const activities: CommunityActivity[] = [
    ...posts.map((post) => ({
      id: post.id,
      kind: "post" as const,
      roomId: post.roomId,
      postId: post.id,
      authorUserId: post.authorUserId,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt,
      profile: post.profile
    })),
    ...comments.map((comment) => {
      const parentPost = postsById.get(comment.postId)!;
      return {
        id: comment.id,
        kind: "comment" as const,
        roomId: parentPost.roomId,
        postId: comment.postId,
        authorUserId: comment.authorUserId,
        title: `${parentPost.title}へのコメント`,
        body: comment.stamp?.name ?? comment.body,
        createdAt: comment.createdAt,
        profile: comment.profile
      };
    }),
    ...(chatActivityResult.data ?? []).map((message: any) => ({
      id: message.id,
      kind: "chat" as const,
      roomId: message.room_id,
      postId: null,
      authorUserId: message.author_user_id,
      title: rooms.find((room) => room.id === message.room_id)?.title ?? "チャット",
      body: message.stamp_id ? stampsById.get(message.stamp_id)?.name ?? "スタンプ" : message.body,
      createdAt: message.created_at,
      profile: profilesByUser.get(message.author_user_id) ?? null
    }))
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 12);

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
    profiles,
    entitlements: ownEntitlements,
    entitlementDefinitions: (definitionsResult.data ?? []).map(mapEntitlementDefinition),
    ownerMembers,
    invitations: (invitationsResult.data ?? []).map(mapInvitation),
    membershipPlans: (membershipPlansResult.data ?? []).map(mapMembershipPlan),
    paymentClaims: (paymentClaimsResult.data ?? []).map(mapPaymentClaim),
    dataRequests: (dataRequestsResult.data ?? []).map(mapDataRequest),
    operatorProfile: operatorProfileResult.data ? mapOperatorProfile(operatorProfileResult.data) : null,
    rooms,
    posts,
    events: (eventsResult.data ?? []).map(mapEvent),
    resources: (resourcesResult.data ?? []).map(mapResource),
    stamps,
    activities,
    safetySettings: safetyResult.data ? mapSafetySettings(safetyResult.data) : null,
    myJoinApplication: myApplicationResult.data ? mapJoinApplication(myApplicationResult.data) : null,
    joinApplications: (applicationsResult.data ?? []).map(mapJoinApplication),
    blockedWords: (blockedWordsResult.data ?? []).map(mapBlockedWord),
    reports: (reportsResult.data ?? []).map(mapReport),
    inquiries: (inquiriesResult.data ?? []).map(mapInquiry)
  };
}

export async function submitCommunityJoinApplication(client: DbClient, communityId: string, input: { displayName: string; legalName: string; phone: string; joinReason: string; acceptTerms: boolean; acceptRules: boolean; acceptPrivacy: boolean }) {
  const { data, error } = await client.rpc("community_submit_join_application", {
    p_community_id: communityId,
    p_display_name: input.displayName.trim(),
    p_legal_name: input.legalName.trim(),
    p_phone: input.phone.trim(),
    p_join_reason: input.joinReason.trim(),
    p_accept_terms: input.acceptTerms,
    p_accept_rules: input.acceptRules,
    p_accept_privacy: input.acceptPrivacy
  });
  if (error) throw error;
  return mapJoinApplication(Array.isArray(data) ? data[0] : data);
}

export async function saveCommunitySafetySettings(client: DbClient, communityId: string, input: Omit<CommunitySafetySettings, "communityId">) {
  const { error } = await client.from("community_safety_settings").upsert({
    community_id: communityId, approval_mode: input.approvalMode,
    require_legal_name: input.requireLegalName, require_phone: input.requirePhone, require_join_reason: input.requireJoinReason,
    terms_version: input.termsVersion, terms_text: input.termsText.trim(), rules_version: input.rulesVersion, rules_text: input.rulesText.trim(),
    privacy_version: input.privacyVersion, privacy_text: input.privacyText.trim(), new_member_limit_enabled: input.newMemberLimitEnabled,
    new_member_limit_hours: input.newMemberLimitHours, new_member_max_actions: input.newMemberMaxActions
  });
  if (error) throw error;
}

export async function reviewCommunityJoinApplication(client: DbClient, applicationId: string, decision: "approved" | "rejected", note = "") {
  const { error } = await client.rpc("community_review_join_application", { p_application_id: applicationId, p_decision: decision, p_review_note: note.trim() || null });
  if (error) throw error;
}

export async function addCommunityBlockedWord(client: DbClient, communityId: string, userId: string, term: string, action: "warn" | "block") {
  const { error } = await client.from("community_blocked_words").insert({ community_id: communityId, created_by_user_id: userId, term: term.trim(), action });
  if (error) throw error;
}

export async function deleteCommunityBlockedWord(client: DbClient, id: string) {
  const { error } = await client.from("community_blocked_words").delete().eq("id", id);
  if (error) throw error;
}

export async function createCommunityReport(client: DbClient, input: { communityId: string; reporterUserId: string; targetType: CommunityReport["targetType"]; targetId?: string; reason: string; details: string; snapshot?: Record<string, unknown> }) {
  const { error } = await client.from("community_reports").insert({ community_id: input.communityId, reporter_user_id: input.reporterUserId, target_type: input.targetType, target_id: input.targetId ?? null, reason: input.reason, details: input.details.trim() || null, content_snapshot: input.snapshot ?? {} });
  if (error) throw error;
}

export async function updateCommunityReportStatus(client: DbClient, id: string, status: CommunityReportStatus, note: string, handlerUserId: string) {
  const { error } = await client.from("community_reports").update({ status, resolution_note: note.trim() || null, handled_by_user_id: handlerUserId, resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw error;
}

export async function createCommunityInquiry(client: DbClient, input: { communityId: string; userId: string; category: string; subject: string; body: string }) {
  const { error } = await client.from("community_inquiries").insert({ community_id: input.communityId, user_id: input.userId, category: input.category, subject: input.subject.trim(), body: input.body.trim() });
  if (error) throw error;
}

export async function updateCommunityInquiryStatus(client: DbClient, id: string, status: CommunityInquiryStatus, note: string, handlerUserId: string) {
  const { error } = await client.from("community_inquiries").update({ status, response_note: note.trim() || null, handled_by_user_id: handlerUserId, closed_at: status === "closed" ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw error;
}

export async function claimCommunityOwnership(client: DbClient, communityId: string, userId: string) {
  const { error } = await client.from("community_communities").update({ owner_user_id: userId }).eq("id", communityId).is("owner_user_id", null);
  if (error) throw error;
}

export async function saveCommunitySettings(client: DbClient, communityId: string, input: { name: string; description: string; joinMode: Community["joinMode"]; homeMetrics: [CommunityHomeMetric, CommunityHomeMetric, CommunityHomeMetric]; logoUrl?: string | null; bannerUrl?: string | null }) {
  const { error } = await client.from("community_communities").update({
    name: input.name.trim(),
    description: input.description.trim() || null,
    join_mode: input.joinMode,
    home_metric_1: input.homeMetrics[0],
    home_metric_2: input.homeMetrics[1],
    home_metric_3: input.homeMetrics[2],
    ...(input.logoUrl !== undefined ? { logo_url: input.logoUrl } : {}),
    ...(input.bannerUrl !== undefined ? { banner_url: input.bannerUrl } : {})
  }).eq("id", communityId);
  if (error) throw error;
}

export async function saveCommunityProfile(client: DbClient, communityId: string, userId: string, displayName: string, bio: string, avatarColor: CommunityRoomColor, avatarUrl?: string | null) {
  const { error } = await client.from("community_member_profiles").upsert(
    { community_id: communityId, user_id: userId, display_name: displayName.trim() || "COMMUNITY participant", bio: bio.trim() || null, avatar_color: avatarColor, ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}) },
    { onConflict: "community_id,user_id" }
  );
  if (error) throw error;
}

export async function createCommunityRoom(client: DbClient, communityId: string, input: { title: string; description: string; kind: CommunityRoomKind; conversationMode: CommunityConversationMode; accessType: CommunityRoomAccessType; themeColor: CommunityRoomColor; entitlementKey?: string }) {
  const roomId = globalThis.crypto.randomUUID();
  const { error } = await client.from("community_rooms").insert({
    id: roomId,
    community_id: communityId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    kind: input.kind,
    conversation_mode: input.conversationMode,
    access_type: input.accessType,
    theme_color: input.themeColor,
    member_can_post: input.kind !== "announcement",
    member_can_comment: true,
    sort_order: 100
  });
  if (error) throw error;
  if (input.accessType === "entitlement" && input.entitlementKey) {
    const { error: ruleError } = await client.from("community_room_entitlement_rules").insert({ community_id: communityId, room_id: roomId, entitlement_key: input.entitlementKey });
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

export async function updateCommunityRoom(client: DbClient, roomId: string, communityId: string, input: { title: string; description: string; kind: CommunityRoomKind; conversationMode: CommunityConversationMode; themeColor: CommunityRoomColor; sortOrder: number; memberCanPost: boolean; memberCanComment: boolean }) {
  const { error } = await client.from("community_rooms").update({
    title: input.title.trim(),
    description: input.description.trim() || null,
    kind: input.kind,
    conversation_mode: input.conversationMode,
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

export async function inviteCommunityMemberByMikkeId(client: DbClient, communityId: string, mikkeId: string, entitlementKey?: string) {
  const { data, error } = await client.rpc("community_invite_by_mikke_id", {
    p_community_id: communityId,
    p_mikke_id: mikkeId.trim(),
    p_entitlement_key: entitlementKey?.trim() || null,
    p_expires_at: null
  });
  if (error) throw error;
  return data;
}

export async function createCommunityMembershipPlan(client: DbClient, communityId: string, userId: string, input: {
  entitlementKey: string;
  name: string;
  description: string;
  amountYen: number;
  billingInterval: CommunityMembershipPlan["billingInterval"];
  paymentProviderLabel: string;
  externalPaymentUrl: string;
  status: CommunityMembershipPlan["status"];
}) {
  const { error } = await client.from("community_membership_plans").insert({
    community_id: communityId,
    entitlement_key: input.entitlementKey,
    name: input.name.trim(),
    description: input.description.trim() || null,
    amount_yen: input.amountYen,
    billing_interval: input.billingInterval,
    payment_provider_label: input.paymentProviderLabel.trim() || "外部決済",
    external_payment_url: input.externalPaymentUrl.trim(),
    status: input.status,
    created_by_user_id: userId
  });
  if (error) throw error;
}

export async function createCommunityPaymentClaim(client: DbClient, communityId: string, planId: string, userId: string, payerName: string, externalReference: string, note: string) {
  if (!userId) throw new Error("ログインが必要です。");
  const { error } = await client.rpc("community_create_payment_claim", {
    p_community_id: communityId,
    p_plan_id: planId,
    p_payer_name: payerName.trim(),
    p_external_reference: externalReference.trim() || null,
    p_note: note.trim() || null
  });
  if (error) throw error;
}

export async function reviewCommunityPaymentClaim(client: DbClient, claimId: string, reviewerUserId: string, approved: boolean, note = "") {
  if (!reviewerUserId) throw new Error("ログインが必要です。");
  const { error } = await client.rpc("community_review_payment_claim", {
    p_claim_id: claimId,
    p_approved: approved,
    p_review_note: note.trim() || null
  });
  if (error) throw error;
}

export async function createCommunityDataRequest(client: DbClient, communityId: string, userId: string, requestType: CommunityMemberDataRequest["requestType"], note = "") {
  const { error } = await client.from("community_member_data_requests").insert({
    community_id: communityId, user_id: userId, request_type: requestType,
    member_note: note.trim() || null, status: "received"
  });
  if (error) throw error;
}

export async function leaveCommunity(client: DbClient, communityId: string) {
  const { error } = await client.rpc("community_leave", { p_community_id: communityId });
  if (error) throw error;
}

export async function saveCommunityOperatorProfile(client: DbClient, communityId: string, input: Omit<CommunityOperatorProfile, "communityId" | "status">) {
  const { error } = await client.from("community_operator_profiles").upsert({
    community_id: communityId, business_name: input.businessName.trim(),
    representative_name: input.representativeName.trim(), business_type: input.businessType,
    postal_address: input.postalAddress.trim(), contact_email: input.contactEmail.trim(),
    contact_phone: input.contactPhone?.trim() || null, website_url: input.websiteUrl?.trim() || null,
    commercial_disclosure_url: input.commercialDisclosureUrl?.trim() || null,
    privacy_policy_url: input.privacyPolicyUrl?.trim() || null, terms_url: input.termsUrl?.trim() || null,
    status: "submitted"
  }, { onConflict: "community_id" });
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

async function assertCommunityContentAllowed(client: DbClient, communityId: string, content: string) {
  if (!content.trim()) return;
  const { data, error } = await client.from("community_blocked_words").select("term,action").eq("community_id", communityId).eq("is_active", true);
  if (error) throw error;
  const normalized = content.toLocaleLowerCase("ja");
  const match = (data ?? []).find((item: any) => normalized.includes(String(item.term).toLocaleLowerCase("ja")));
  if (!match) return;
  if (match.action === "block") throw new Error("禁止ワードが含まれているため送信できません。表現を変更してください。");
  throw new Error("運営者が注意表現に設定した言葉が含まれています。内容を確認して表現を変更してください。");
}

export async function createCommunityPost(client: DbClient, input: { communityId: string; roomId: string; authorUserId: string; title: string; body: string; kind: CommunityPostKind; url?: string; imageUrl?: string; isPinned?: boolean }) {
  await assertCommunityContentAllowed(client, input.communityId, `${input.title} ${input.body}`);
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
  const { data: current, error: currentError } = await client.from("community_posts").select("community_id").eq("id", postId).single();
  if (currentError) throw currentError;
  await assertCommunityContentAllowed(client, current.community_id, `${input.title} ${input.body}`);
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
  if (body.trim()) {
    const { data: parent, error: parentError } = await client.from("community_posts").select("community_id").eq("id", postId).single();
    if (parentError) throw parentError;
    await assertCommunityContentAllowed(client, parent.community_id, body);
  }
  const { error } = await client.from("community_comments").insert({ post_id: postId, author_user_id: authorUserId, body: body.trim() || "スタンプ", stamp_id: stampId ?? null });
  if (error) throw error;
}

export async function updateCommunityComment(client: DbClient, commentId: string, authorUserId: string, body: string) {
  const { data: current, error: currentError } = await client.from("community_comments").select("community_posts(community_id)").eq("id", commentId).single();
  if (currentError) throw currentError;
  const post = Array.isArray(current.community_posts) ? current.community_posts[0] : current.community_posts;
  await assertCommunityContentAllowed(client, post.community_id, body);
  const { error } = await client.from("community_comments").update({ body: body.trim() }).eq("id", commentId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export async function deleteCommunityComment(client: DbClient, commentId: string, authorUserId: string) {
  const { error } = await client.from("community_comments").update({ deleted_at: new Date().toISOString(), deleted_by_user_id: authorUserId }).eq("id", commentId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export async function loadCommunityChatMessages(client: DbClient, roomId: string, userId: string, profiles: CommunityMemberProfile[], stamps: CommunityStamp[]) {
  const [messagesResult, reactionsResult] = await Promise.all([
    client.from("community_chat_messages").select("*").eq("room_id", roomId).eq("is_hidden", false).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    client.from("community_chat_message_reactions").select("message_id,user_id,emoji,created_at").eq("room_id", roomId).order("created_at", { ascending: true }).limit(1000)
  ]);
  if (messagesResult.error) throw messagesResult.error;
  if (reactionsResult.error) throw reactionsResult.error;

  const profilesByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const stampsById = new Map(stamps.map((stamp) => [stamp.id, stamp]));
  const messages = (messagesResult.data ?? []).map(mapChatMessage).reverse();
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const reactionGroups = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const reaction of reactionsResult.data ?? []) {
    const byEmoji = reactionGroups.get(reaction.message_id) ?? new Map<string, { count: number; reactedByMe: boolean }>();
    const current = byEmoji.get(reaction.emoji) ?? { count: 0, reactedByMe: false };
    current.count += 1;
    if (reaction.user_id === userId) current.reactedByMe = true;
    byEmoji.set(reaction.emoji, current);
    reactionGroups.set(reaction.message_id, byEmoji);
  }
  for (const message of messages) {
    message.profile = profilesByUser.get(message.authorUserId) ?? null;
    message.replyTo = message.replyToMessageId ? messagesById.get(message.replyToMessageId) ?? null : null;
    message.stamp = message.stampId ? stampsById.get(message.stampId) ?? null : null;
    message.reactions = [...(reactionGroups.get(message.id) ?? new Map()).entries()].map(([emoji, reaction]) => ({ emoji, count: reaction.count, reactedByMe: reaction.reactedByMe }));
  }
  return messages;
}

async function toggleCommunityReaction(client: DbClient, input: { table: "community_post_reactions" | "community_comment_reactions"; targetColumn: "post_id" | "comment_id"; targetId: string; communityId: string; roomId: string; postId: string; userId: string; emoji: string }) {
  const { data: existing, error: lookupError } = await client
    .from(input.table)
    .select("id")
    .eq(input.targetColumn, input.targetId)
    .eq("user_id", input.userId)
    .eq("emoji", input.emoji)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await client.from(input.table).delete().eq("id", existing.id).eq("user_id", input.userId);
    if (error) throw error;
    return;
  }
  const values: Record<string, string> = {
    community_id: input.communityId,
    room_id: input.roomId,
    post_id: input.postId,
    user_id: input.userId,
    emoji: input.emoji
  };
  values[input.targetColumn] = input.targetId;
  const { error } = await client.from(input.table).insert(values);
  if (error) throw error;
}

export async function toggleCommunityPostBookmark(client: DbClient, input: { communityId: string; roomId: string; postId: string; userId: string; bookmarked: boolean }) {
  if (input.bookmarked) {
    const { error } = await client
      .from("community_post_bookmarks")
      .delete()
      .eq("post_id", input.postId)
      .eq("user_id", input.userId);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("community_post_bookmarks").insert({
    community_id: input.communityId,
    room_id: input.roomId,
    post_id: input.postId,
    user_id: input.userId
  });
  if (error) throw error;
}

export async function searchCommunity(client: DbClient, communityId: string, communitySlug: string, rawQuery: string): Promise<CommunitySearchResult[]> {
  const query = rawQuery.trim().replace(/[,%_\\()]/g, " ").replace(/\s+/g, " ");
  if (query.length < 2) return [];
  const pattern = `%${query}%`;
  const [rooms, posts, comments, chat, events, resources] = await Promise.all([
    client.from("community_rooms").select("id,title,description").eq("community_id", communityId).eq("is_archived", false).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(12),
    client.from("community_posts").select("id,room_id,title,body,created_at").eq("community_id", communityId).eq("is_hidden", false).is("deleted_at", null).or(`title.ilike.${pattern},body.ilike.${pattern}`).order("created_at", { ascending: false }).limit(20),
    client.from("community_comments").select("id,post_id,body,created_at,community_posts!inner(id,room_id,community_id,title)").eq("community_posts.community_id", communityId).eq("is_hidden", false).is("deleted_at", null).ilike("body", pattern).order("created_at", { ascending: false }).limit(20),
    client.from("community_chat_messages").select("id,room_id,body,created_at").eq("community_id", communityId).eq("is_hidden", false).is("deleted_at", null).ilike("body", pattern).order("created_at", { ascending: false }).limit(20),
    client.from("community_events").select("id,title,description,starts_at").eq("community_id", communityId).neq("status", "cancelled").or(`title.ilike.${pattern},description.ilike.${pattern}`).order("starts_at", { ascending: false }).limit(12),
    client.from("community_resources").select("id,title,description,published_at").eq("community_id", communityId).eq("is_published", true).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(12)
  ]);
  const firstError = [rooms, posts, comments, chat, events, resources].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  const base = `/community/c/${communitySlug}`;
  const results: CommunitySearchResult[] = [];
  for (const row of rooms.data ?? []) results.push({ id: row.id, kind: "room", title: row.title, excerpt: row.description ?? "", href: `${base}/rooms/${row.id}`, createdAt: null });
  for (const row of posts.data ?? []) results.push({ id: row.id, kind: "post", title: row.title, excerpt: row.body, href: `${base}/rooms/${row.room_id}/posts/${row.id}`, createdAt: row.created_at });
  for (const row of comments.data ?? []) {
    const post: any = Array.isArray(row.community_posts) ? row.community_posts[0] : row.community_posts;
    if (post) results.push({ id: row.id, kind: "comment", title: post.title, excerpt: row.body, href: `${base}/rooms/${post.room_id}/posts/${row.post_id}`, createdAt: row.created_at });
  }
  for (const row of chat.data ?? []) results.push({ id: row.id, kind: "chat", title: "チャットメッセージ", excerpt: row.body, href: `${base}/rooms/${row.room_id}`, createdAt: row.created_at });
  for (const row of events.data ?? []) results.push({ id: row.id, kind: "event", title: row.title, excerpt: row.description ?? "", href: `${base}/events`, createdAt: row.starts_at });
  for (const row of resources.data ?? []) results.push({ id: row.id, kind: "resource", title: row.title, excerpt: row.description ?? "", href: `${base}/library`, createdAt: row.published_at });
  return results.sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));
}

export async function toggleCommunityPostReaction(client: DbClient, input: { communityId: string; roomId: string; postId: string; userId: string; emoji: string }) {
  return toggleCommunityReaction(client, { ...input, table: "community_post_reactions", targetColumn: "post_id", targetId: input.postId });
}

export async function toggleCommunityCommentReaction(client: DbClient, input: { communityId: string; roomId: string; postId: string; commentId: string; userId: string; emoji: string }) {
  return toggleCommunityReaction(client, { ...input, table: "community_comment_reactions", targetColumn: "comment_id", targetId: input.commentId });
}

export async function toggleCommunityChatReaction(client: DbClient, input: { communityId: string; roomId: string; messageId: string; userId: string; emoji: string }) {
  const { data: existing, error: lookupError } = await client
    .from("community_chat_message_reactions")
    .select("id")
    .eq("message_id", input.messageId)
    .eq("user_id", input.userId)
    .eq("emoji", input.emoji)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await client.from("community_chat_message_reactions").delete().eq("id", existing.id).eq("user_id", input.userId);
    if (error) throw error;
    return;
  }
  const { error } = await client.from("community_chat_message_reactions").insert({
    community_id: input.communityId,
    room_id: input.roomId,
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji
  });
  if (error) throw error;
}

export async function markCommunityRoomSeen(client: DbClient, communityId: string, roomId: string, userId: string) {
  const { error } = await client.from("community_room_reads").upsert({
    community_id: communityId,
    room_id: roomId,
    user_id: userId,
    last_seen_at: new Date().toISOString()
  }, { onConflict: "community_id,room_id,user_id" });
  if (error) throw error;
}

export async function createCommunityChatMessage(client: DbClient, input: { communityId: string; roomId: string; authorUserId: string; body: string; replyToMessageId?: string; stampId?: string }) {
  if (input.body.trim()) await assertCommunityContentAllowed(client, input.communityId, input.body);
  const { error } = await client.from("community_chat_messages").insert({
    community_id: input.communityId,
    room_id: input.roomId,
    author_user_id: input.authorUserId,
    reply_to_message_id: input.replyToMessageId ?? null,
    stamp_id: input.stampId ?? null,
    body: input.body.trim() || "スタンプ"
  });
  if (error) throw error;
}

export async function updateCommunityChatMessage(client: DbClient, messageId: string, authorUserId: string, body: string) {
  const { data: current, error: currentError } = await client.from("community_chat_messages").select("community_id").eq("id", messageId).single();
  if (currentError) throw currentError;
  await assertCommunityContentAllowed(client, current.community_id, body);
  const { error } = await client.from("community_chat_messages").update({ body: body.trim(), edited_at: new Date().toISOString() }).eq("id", messageId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export async function deleteCommunityChatMessage(client: DbClient, messageId: string, authorUserId: string) {
  const { error } = await client.from("community_chat_messages").update({ deleted_at: new Date().toISOString(), deleted_by_user_id: authorUserId }).eq("id", messageId).eq("author_user_id", authorUserId);
  if (error) throw error;
}

export async function moderateCommunityChatMessage(client: DbClient, messageId: string, hidden: boolean) {
  const { error } = await client.from("community_chat_messages").update({ is_hidden: hidden }).eq("id", messageId);
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

export async function getMyCommunityAcademyAccessInvitation(
  client: DbClient,
  invitationId: string
) {
  const { data, error } = await client.rpc("community_get_my_academy_access_invitation", {
    p_invitation_id: invitationId
  });
  if (error) throw error;
  return (data ?? null) as CommunityAcademyAccessInvitation | null;
}

export async function acceptCommunityAcademyAccessInvitation(
  client: DbClient,
  input: {
    invitationId: string;
    displayName: string;
    legalName?: string;
    phone?: string;
    joinReason?: string;
  }
) {
  const { data, error } = await client.rpc("community_accept_academy_access_invitation", {
    p_invitation_id: input.invitationId,
    p_display_name: input.displayName.trim(),
    p_legal_name: input.legalName?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_join_reason: input.joinReason?.trim() || null,
    p_accept_terms: true,
    p_accept_rules: true,
    p_accept_privacy: true
  });
  if (error) throw error;
  return data as string;
}
