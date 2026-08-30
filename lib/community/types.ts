export type CommunityRole = "owner" | "moderator" | "member";
export type CommunityMembershipStatus = "active" | "suspended" | "left";
export type CommunityMembershipAccessScope = "community" | "linked_rooms";
export type CommunityRoomKind = "announcement" | "normal" | "question" | "event";
export type CommunityConversationMode = "thread" | "chat";
export type CommunityRoomAccessType = "free" | "entitlement" | "staff";
export type CommunityRoomColor = "blue" | "orange" | "yellow" | "pink" | "green";
export type CommunityPostKind = "announcement" | "normal" | "question";
export type CommunityEventStatus = "open" | "closed" | "cancelled";
export type CommunityResourceKind = "web" | "pdf" | "video" | "other";
export type CommunityEntitlementStatus = "active" | "revoked" | "expired";
export type CommunityEntitlementSource = "manual" | "subscription" | "external" | "academy_subscription";
export type CommunityAcademyRole = "learner" | "instructor" | "staff" | "contract_holder";
export type CommunityInvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";
export type CommunityMembershipPlanStatus = "draft" | "active" | "archived";
export type CommunityPaymentClaimStatus = "pending" | "approved" | "rejected" | "cancelled";
export type CommunityDataRequestStatus = "received" | "identity_check" | "processing" | "completed" | "rejected" | "cancelled";
export type CommunityHomeMetric = "unread" | "today_activity" | "upcoming_events" | "rooms" | "posts" | "comments" | "chat_messages" | "resources";
export type CommunityApprovalMode = "auto" | "manual";
export type CommunityApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";
export type CommunityReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type CommunityInquiryStatus = "open" | "reviewing" | "answered" | "closed";
export type CommunityPlatformPlanKey = "trial" | "starter" | "standard" | "pro" | "enterprise";
export type CommunityPlatformSubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "suspended";

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  joinMode: "open_free" | "invite_only" | "paid";
  status: "active" | "archived";
  ownerUserId: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  homeMetrics: [CommunityHomeMetric, CommunityHomeMetric, CommunityHomeMetric];
};

export type CommunityPublicEntry = Pick<Community, "slug" | "name" | "description" | "joinMode" | "status" | "logoUrl" | "bannerUrl">;

export type CommunityMembership = {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityRole;
  status: CommunityMembershipStatus;
  accessScope: CommunityMembershipAccessScope;
  joinedAt: string;
  memo: string | null;
};

export type CommunityMemberProfile = {
  id: string;
  communityId: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  avatarColor: CommunityRoomColor;
  createdAt: string;
  updatedAt: string;
};

export type CommunityEntitlementDefinition = {
  id: string;
  communityId: string;
  key: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
};

export type CommunityMemberEntitlement = {
  id: string;
  communityId: string;
  userId: string;
  entitlementKey: string;
  source: CommunityEntitlementSource;
  sourceReference: string | null;
  status: CommunityEntitlementStatus;
  startsAt: string;
  endsAt: string | null;
};

export type CommunityOwnerMember = {
  membership: CommunityMembership;
  profile: CommunityMemberProfile | null;
  entitlements: CommunityMemberEntitlement[];
};

export type CommunityInvitation = {
  id: string;
  communityId: string;
  invitedUserId: string;
  invitedByUserId: string;
  invitedMikkeId: string;
  entitlementKey: string | null;
  status: CommunityInvitationStatus;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

export type CommunityAcademyAccessInvitation = {
  id: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  academyRole: CommunityAcademyRole;
  startsAt: string;
  endsAt: string | null;
  expiresAt: string | null;
  community: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
  };
  access: {
    entitlementKey: string;
    name: string;
    description: string | null;
    rooms: Array<{ id: string; title: string; description: string | null }>;
  };
  consent: {
    requireLegalName: boolean;
    requirePhone: boolean;
    requireJoinReason: boolean;
    termsVersion: number;
    termsText: string;
    rulesVersion: number;
    rulesText: string;
    privacyVersion: number;
    privacyText: string;
  };
  hasNormalCommunityAccess: boolean;
};

export type CommunityMembershipPlan = {
  id: string;
  communityId: string;
  entitlementKey: string;
  name: string;
  description: string | null;
  amountYen: number;
  billingInterval: "month" | "year" | "one_time";
  paymentProviderLabel: string;
  externalPaymentUrl: string;
  status: CommunityMembershipPlanStatus;
  sortOrder: number;
};

export type CommunityPaymentClaim = {
  id: string;
  communityId: string;
  planId: string;
  userId: string;
  payerName: string;
  externalReference: string | null;
  note: string | null;
  status: CommunityPaymentClaimStatus;
  reviewNote: string | null;
  createdAt: string;
};

export type CommunityMemberDataRequest = {
  id: string;
  communityId: string;
  userId: string;
  requestType: "data_export" | "personal_data_delete";
  status: CommunityDataRequestStatus;
  memberNote: string | null;
  responseNote: string | null;
  createdAt: string;
};

export type CommunityOperatorProfile = {
  communityId: string;
  businessName: string;
  representativeName: string;
  businessType: "individual" | "sole_proprietor" | "corporation" | "organization";
  postalAddress: string;
  contactEmail: string;
  contactPhone: string | null;
  websiteUrl: string | null;
  commercialDisclosureUrl: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  status: "incomplete" | "submitted" | "verified";
};

export type CommunityPlatformSubscription = {
  communityId: string;
  planKey: CommunityPlatformPlanKey;
  status: CommunityPlatformSubscriptionStatus;
  currentPeriodEndsAt: string | null;
};

export type CommunitySafetySettings = {
  communityId: string;
  approvalMode: CommunityApprovalMode;
  requireLegalName: boolean;
  requirePhone: boolean;
  requireJoinReason: boolean;
  termsVersion: number;
  termsText: string;
  rulesVersion: number;
  rulesText: string;
  privacyVersion: number;
  privacyText: string;
  newMemberLimitEnabled: boolean;
  newMemberLimitHours: number;
  newMemberMaxActions: number;
};

export type CommunityJoinApplication = {
  id: string;
  communityId: string;
  userId: string;
  displayName: string;
  legalName: string | null;
  email: string;
  phone: string | null;
  joinReason: string | null;
  status: CommunityApplicationStatus;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type CommunityBlockedWord = {
  id: string;
  communityId: string;
  term: string;
  action: "warn" | "block";
  isActive: boolean;
  createdAt: string;
};

export type CommunityReport = {
  id: string;
  communityId: string;
  reporterUserId: string;
  targetType: "post" | "comment" | "chat" | "profile" | "member" | "other";
  targetId: string | null;
  reason: string;
  details: string | null;
  status: CommunityReportStatus;
  resolutionNote: string | null;
  createdAt: string;
};

export type CommunityInquiry = {
  id: string;
  communityId: string;
  userId: string;
  category: string;
  subject: string;
  body: string;
  status: CommunityInquiryStatus;
  responseNote: string | null;
  createdAt: string;
};

export type CommunityRoom = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  kind: CommunityRoomKind;
  conversationMode: CommunityConversationMode;
  accessType: CommunityRoomAccessType;
  themeColor: CommunityRoomColor;
  requiredEntitlementKeys: string[];
  isLocked: boolean;
  sortOrder: number;
  isArchived: boolean;
  memberCanPost: boolean;
  memberCanComment: boolean;
  unreadCount: number;
  postCount: number;
  commentCount: number;
  messageCount: number;
  recentSpeakerUserIds: string[];
  speakerCount: number;
};

export type CommunityPost = {
  id: string;
  communityId: string;
  roomId: string;
  authorUserId: string;
  title: string;
  body: string;
  kind: CommunityPostKind;
  url: string | null;
  imageUrl: string | null;
  isPinned: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  room?: Pick<CommunityRoom, "id" | "title" | "kind"> | null;
  profile?: Pick<CommunityMemberProfile, "displayName" | "avatarUrl" | "avatarColor"> | null;
  comments?: CommunityComment[];
  attachments?: CommunityPostAttachment[];
  reactions: CommunityReactionGroup[];
  bookmarkedByMe: boolean;
};

export type CommunityPostAttachment = {
  id: string;
  communityId: string;
  postId: string;
  uploaderUserId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

export type CommunityStamp = {
  id: string;
  communityId: string;
  name: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorUserId: string;
  body: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  stampId: string | null;
  stamp?: CommunityStamp | null;
  profile?: Pick<CommunityMemberProfile, "displayName" | "avatarUrl" | "avatarColor"> | null;
  reactions: CommunityReactionGroup[];
};

export type CommunityChatMessage = {
  id: string;
  communityId: string;
  roomId: string;
  authorUserId: string;
  replyToMessageId: string | null;
  stampId: string | null;
  body: string;
  isHidden: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: Pick<CommunityMemberProfile, "displayName" | "avatarUrl" | "avatarColor"> | null;
  replyTo?: CommunityChatMessage | null;
  stamp?: CommunityStamp | null;
  reactions: CommunityReactionGroup[];
};

export type CommunitySearchResult = {
  id: string;
  kind: "room" | "post" | "comment" | "chat" | "event" | "resource";
  title: string;
  excerpt: string;
  href: string;
  createdAt: string | null;
};

export type CommunityReactionGroup = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type CommunityChatReactionGroup = CommunityReactionGroup;

export type CommunityActivity = {
  id: string;
  kind: "post" | "comment" | "chat";
  roomId: string;
  postId: string | null;
  authorUserId: string;
  title: string;
  body: string;
  createdAt: string;
  profile?: Pick<CommunityMemberProfile, "displayName" | "avatarUrl" | "avatarColor"> | null;
};

export type CommunityEvent = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  locationLabel: string | null;
  externalUrl: string | null;
  status: CommunityEventStatus;
  sortOrder: number;
  attendeeStatus?: "going" | null;
};

export type CommunityResource = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  kind: CommunityResourceKind;
  externalUrl: string;
  isPublished: boolean;
  sortOrder: number;
  publishedAt: string | null;
};

export type CommunityDashboard = {
  community: Community;
  membership: CommunityMembership | null;
  profile: CommunityMemberProfile | null;
  profiles: CommunityMemberProfile[];
  entitlements: CommunityMemberEntitlement[];
  entitlementDefinitions: CommunityEntitlementDefinition[];
  ownerMembers: CommunityOwnerMember[];
  invitations: CommunityInvitation[];
  membershipPlans: CommunityMembershipPlan[];
  paymentClaims: CommunityPaymentClaim[];
  dataRequests: CommunityMemberDataRequest[];
  operatorProfile: CommunityOperatorProfile | null;
  platformSubscription: CommunityPlatformSubscription | null;
  rooms: CommunityRoom[];
  posts: CommunityPost[];
  events: CommunityEvent[];
  resources: CommunityResource[];
  stamps: CommunityStamp[];
  activities: CommunityActivity[];
  safetySettings: CommunitySafetySettings | null;
  myJoinApplication: CommunityJoinApplication | null;
  joinApplications: CommunityJoinApplication[];
  blockedWords: CommunityBlockedWord[];
  reports: CommunityReport[];
  inquiries: CommunityInquiry[];
};
