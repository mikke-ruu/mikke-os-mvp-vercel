export type MediaSession = {
  subject: string;
  isAnonymous: boolean;
};

export type MediaDirectOwnerSite = {
  id: string;
  name: string;
  slug: string;
  description: string;
  author_name: string;
  default_locale: string;
  publishing_policy: "direct_owner";
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type MediaCreateInput = {
  name: string;
  slug: string;
  description: string;
  authorName: string;
  defaultLocale?: string;
};

export interface MediaManagementTransport {
  readSession(): Promise<MediaSession | null>;
  subscribeSessionChange(listener: () => void): () => void;
  listDirectOwnerSites(): Promise<MediaDirectOwnerSite[]>;
  createDirectOwnerSite(input: MediaCreateInput): Promise<string>;
}

export type MediaBoundaryResult<T> =
  | { status: "ok"; value: T }
  | { status: "unauthenticated" }
  | { status: "stale" };

function sameHumanSession(before: MediaSession, after: MediaSession | null) {
  return Boolean(after && !after.isAnonymous && after.subject === before.subject);
}

function requireHumanSession(session: MediaSession | null): MediaSession | null {
  return session && session.subject && !session.isAnonymous ? session : null;
}

export class MediaSessionBoundary {
  private requestVersion = 0;
  private readonly unsubscribe: () => void;
  private readonly transport: MediaManagementTransport;

  constructor(transport: MediaManagementTransport) {
    this.transport = transport;
    this.unsubscribe = transport.subscribeSessionChange(() => this.invalidate());
  }

  invalidate() {
    this.requestVersion += 1;
  }

  dispose() {
    this.invalidate();
    this.unsubscribe();
  }

  private async run<T>(operation: () => Promise<T>): Promise<MediaBoundaryResult<T>> {
    const version = ++this.requestVersion;
    const initialSession = await this.transport.readSession();
    if (version !== this.requestVersion) return { status: "stale" };
    const before = requireHumanSession(initialSession);
    if (!before) return { status: "unauthenticated" };

    const value = await operation();
    const after = await this.transport.readSession();
    if (version !== this.requestVersion || !sameHumanSession(before, after)) return { status: "stale" };
    return { status: "ok", value };
  }

  async listMyFreeMedia(): Promise<MediaBoundaryResult<MediaDirectOwnerSite[]>> {
    return this.run(async () => {
      const rows = await this.transport.listDirectOwnerSites();
      if (rows.some((row) => row.publishing_policy !== "direct_owner")) {
        throw new Error("MEDIA_MANAGED_BRAND_IN_FREE_RESULT");
      }
      return rows;
    });
  }

  createMyFreeMedia(input: MediaCreateInput): Promise<MediaBoundaryResult<string>> {
    return this.run(() => this.transport.createDirectOwnerSite(input));
  }
}
