import type { createMediaDatabaseOperations, MediaArticleDraftInput, MediaPublicationAttestation } from "./database-operations";
type Operations = ReturnType<typeof createMediaDatabaseOperations>;
export type MediaEditorResult<T> = {status:"ok"; value:T} | {status:"session_changed"} | {status:"failed"};
/** Per-editor session. Never share across accounts or import local drafts.
 * RLS remains authoritative. In-flight writes may commit after cancellation;
 * a stale/failed response must not trigger an automatic retry. */
export async function openMediaDatabaseEditor(operations: Operations) {
  const transport = operations.mediaDatabaseTransport;
  let invalid = false;
  const unsubscribe = transport.subscribeSessionChange(() => { invalid = true; });
  let subject: string;
  try {
    const session = await transport.readSession();
    if (invalid || !session || session.isAnonymous) { unsubscribe(); return null; }
    subject = session.subject;
  } catch { unsubscribe(); return null; }
  let queue: Promise<unknown> = Promise.resolve();
  async function valid() {
    if (invalid) return false;
    const session = await transport.readSession();
    if (invalid || !session || session.isAnonymous || session.subject !== subject) { invalid = true; return false; }
    return true;
  }
  function run<T>(action: () => Promise<T>): Promise<MediaEditorResult<T>> {
    const result = queue.then(async (): Promise<MediaEditorResult<T>> => {
      try {
        if (!await valid()) return {status:"session_changed"};
        const value = await action();
        return await valid() ? {status:"ok",value} : {status:"session_changed"};
      } catch { return invalid ? {status:"session_changed"} : {status:"failed"}; }
    });
    queue = result;
    return result;
  }
  // Copy only editable draft fields before waiting behind a previous save.
  function draft(input: MediaArticleDraftInput): MediaArticleDraftInput {
    return {title:input.title,slug:input.slug,excerpt:input.excerpt,locale:input.locale,blocks:structuredClone(input.blocks),categoryId:input.categoryId,coverImageUrl:input.coverImageUrl,coverImageAssetId:input.coverImageAssetId};
  }
  async function requireArticle(articleId: string) {
    const article = await operations.readMediaArticleDraftFromDatabase(articleId);
    if (!article) throw new Error("MEDIA_EDITOR_NOT_FOUND");
    const sites = await operations.listMyMediaSitesFromDatabase();
    if (!sites.some(site => site.id === article.site_id && site.publishing_policy === "direct_owner")) throw new Error("MEDIA_EDITOR_NOT_FOUND");
    if (!await valid()) throw new Error("MEDIA_EDITOR_SESSION_CHANGED");
    return article;
  }
  return {
    dispose() { invalid = true; unsubscribe(); },
    load(articleId: string) { return run(() => requireArticle(articleId)); },
    save(articleId: string, input: MediaArticleDraftInput) {
      const payload = draft(input);
      return run(async () => { await requireArticle(articleId); return operations.updateMediaArticleDraftInDatabase(articleId,payload); });
    },
    create(siteId: string,input: MediaArticleDraftInput) {
      const payload = draft(input);
      return run(async () => {
        const sites = await operations.listMyMediaSitesFromDatabase();
        if (!sites.some(site=>site.id===siteId && site.publishing_policy==="direct_owner")) throw new Error("MEDIA_EDITOR_NOT_FOUND");
        if (!await valid()) throw new Error("MEDIA_EDITOR_SESSION_CHANGED");
        return operations.createMediaArticleDraftInDatabase(siteId,payload);
      });
    },
    publish(articleId: string, attestation: MediaPublicationAttestation) {
      const consent = {...attestation};
      return run(async () => {
        await requireArticle(articleId);
        if (!consent.termsVersion.trim() || consent.rightsConfirmed!==true || consent.privacyConfirmed!==true || consent.affiliateFreeConfirmed!==true) throw new Error("MEDIA_EDITOR_CONFIRMATION_REQUIRED");
        return operations.publishMediaArticleInDatabase(articleId,consent);
      });
    },
    cancelPublication(articleId: string) {
      return run(async () => { await requireArticle(articleId); await operations.unpublishMediaArticleInDatabase(articleId); });
    }
  };
}
