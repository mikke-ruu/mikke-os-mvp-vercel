export type CommunityRole = "owner" | "moderator" | "member";
export type CommunityMembershipStatus = "active" | "suspended" | "left";
export type CommunityRoomKind = "announcement" | "normal" | "question" | "event";
export type CommunityRoomAccessType = "free" | "entitlement" | "staff";
export type CommunityRoomColor = "blue" | "orange" | "yellow" | "pink" | "green";
export type CommunityPostKind = "announcement" | "normal" | "question";
export type CommunityEventStatus = "open" | "closed" | "cancelled";
export type CommunityResourceKind = "web" | "pdf" | "video" | "other";
export type CommunityEntitlementStatus = "active" | "revoked" | "expired";
export type CommunityEntitlementSource = "manual" | "subscription" | "external";

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  joinMode: "open_free" | "invite_only" | "paid";
  status: "active" | "archived";
  ownerUserId: string | null;
};

export type CommunityPublicEntry = Pick<Community, "slug" | "name" | "description" | "joinMode" | "status">;

export type CommunityMembership = {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityRole;
  status: CommunityMembershipStatus;
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
  status: CommunityEntitlementStatus;
  startsAt: string;
  endsAt: string | null;
};

export type CommunityOwnerMember = {
  membership: CommunityMembership;
  profile: CommunityMemberProfile | null;
  entitlements: CommunityMemberEntitlement[];
};

export type CommunityRoom = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  kind: CommunityRoomKind;
  accessType: CommunityRoomAccessType;
  themeColor: CommunityRoomColor;
  requiredEntitlementKeys: string[];
  isLocked: boolean;
  sortOrder: number;
  isArchived: boolean;
  memberCanPost: boolean;
  memberCanComment: boolean;
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
  isPinned: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  room?: Pick<CommunityRoom, "id" | "title" | "kind"> | null;
  profile?: Pick<CommunityMemberProfile, "displayName" | "avatarUrl"> | null;
  comments?: CommunityComment[];
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorUserId: string;
  body: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: Pick<CommunityMemberProfile, "displayName" | "avatarUrl"> | null;
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
  entitlements: CommunityMemberEntitlement[];
  entitlementDefinitions: CommunityEntitlementDefinition[];
  ownerMembers: CommunityOwnerMember[];
  rooms: CommunityRoom[];
  posts: CommunityPost[];
  events: CommunityEvent[];
  resources: CommunityResource[];
};
