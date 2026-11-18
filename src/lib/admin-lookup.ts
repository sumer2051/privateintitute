export const isTransactionId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

export function lookupPattern(value: string) {
  // Escape LIKE metacharacters so identifiers are searched literally.
  return `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
}

export function uniqueLookupRows<T extends { id: string }>(lists: T[][]): T[] {
  return Array.from(new Map(lists.flat().map(row => [row.id, row])).values());
}