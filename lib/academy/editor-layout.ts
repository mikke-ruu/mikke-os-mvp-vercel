// Only page authoring routes use the available desktop width.
// Public pages, lists, course settings and learner views keep their own layout.
export function isAcademyPageEditorPath(pathname: string): boolean {
  const path = pathname
    .replace(/^\/academy\/h\/[0-9a-f-]{36}\/manage(?=\/|$)/i, "/academy")
    .replace(/^\/academy\/h\/[0-9a-f-]{36}\/teach(?=\/|$)/i, "/academy/portal")
    .replace(/\/$/, "");
  return path === "/academy/front"
    || path === "/academy/portal/offerings"
    || /^\/academy\/offerings\/(?:new|[0-9a-f-]{36})$/i.test(path)
    || /^\/academy\/courses\/[0-9a-f-]{36}\/instructor-page$/i.test(path);
}
