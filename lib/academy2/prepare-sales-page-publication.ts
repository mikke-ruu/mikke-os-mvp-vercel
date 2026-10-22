import type { SalesPageDraft } from './sales-pages';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Save only a previously unsaved page; never replace another editor's draft. */
export async function prepareSalesPageForPublication({ page, planRevision, read, save }: {
  page: SalesPageDraft; planRevision: number;
  read: () => Promise<SalesPageDraft>;
  save: (blocks: SalesPageDraft['blocks']) => Promise<SalesPageDraft>;
}): Promise<SalesPageDraft> {
  const current = await read();
  const sameContent = (row: SalesPageDraft) => canonical(row.blocks) === canonical(page.blocks);
  const currentPlan = (row: SalesPageDraft) => row.current_plan_revision === planRevision && row.plan_revision === planRevision && !row.needs_rebase;
  if (current.revision > 0) {
    // A retry after an uncertain save may safely reuse the identical saved draft.
    if (!currentPlan(current) || !sameContent(current) || (page.revision > 0 && current.revision !== page.revision)) {
      throw new Error('販売ページまたは販売プランが更新されています。表示中の内容は残っています。最新の保存内容を確認してから公開してください。');
    }
    return current;
  }
  if (page.revision !== 0 || current.current_plan_revision !== planRevision) {
    throw new Error('販売ページまたは販売プランが更新されています。最新の保存内容を確認してください。');
  }
  const saved = await save(page.blocks);
  const verified = await read();
  if (saved.revision < 1 || verified.revision !== saved.revision || !currentPlan(verified) || !sameContent(verified)) {
    throw new Error('販売ページの保存結果を確認できないため、公開を中止しました。表示中の内容は残っています。もう一度お試しください。');
  }
  return verified;
}
