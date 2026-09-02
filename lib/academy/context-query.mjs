const ACADEMY_CONTEXT_QUERY_VALUES = Object.freeze({
  audience: new Set(["learner", "instructor"])
});

export function academyContextQuery(search) {
  const source = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search ?? ""));
  const safe = new URLSearchParams();

  for (const [key, allowedValues] of Object.entries(ACADEMY_CONTEXT_QUERY_VALUES)) {
    const values = source.getAll(key);
    if (values.length !== 1 || !allowedValues.has(values[0])) continue;
    safe.set(key, values[0]);
  }

  return safe.toString();
}

export function withAcademyContextQuery(href, search, options = {}) {
  const safe = new URLSearchParams(academyContextQuery(search));
  if (options.readonlyPreview === true) safe.set("preview", "readonly");
  const query = safe.toString();
  return query ? `${href}?${query}` : href;
}
