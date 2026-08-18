export function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function includesSearch(value: unknown, normalizedQuery: string) {
  return normalizeSearchText(value).includes(normalizedQuery);
}
