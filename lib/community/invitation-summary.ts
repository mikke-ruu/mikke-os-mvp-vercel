export function visiblePendingCommunityInvitationRows(rows: any[], now = Date.now()) {
  return rows.flatMap((row) => {
    const community = Array.isArray(row.community_communities)
      ? row.community_communities[0]
      : row.community_communities;
    const expiry = row.expires_at ? new Date(row.expires_at).getTime() : null;
    if (!community || community.status !== "active") return [];
    if (expiry !== null && (!Number.isFinite(expiry) || expiry <= now)) return [];
    return [{ ...row, community_communities: community }];
  });
}
