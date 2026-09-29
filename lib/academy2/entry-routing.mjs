/** Select only from server-authorized memberships. Never opt a legacy HQ in. */
export function headquartersEntryTarget(pathname, headquartersIds, search = '') {
  if (/^\/academy\/h\/[0-9a-f-]{36}\/(manage|teach)(?:\/|$)/i.test(pathname)) return null;
  if (pathname !== '/academy' && !pathname.startsWith('/academy/')) return null;
  if (!headquartersIds.length) return null;
  if (headquartersIds.length > 1) return '/academy/select';
  const id = headquartersIds[0];
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid headquarters membership');
  return '/academy/h/' + id + '/manage' + pathname.slice('/academy'.length) + (search.startsWith('?') ? search : '');
}
