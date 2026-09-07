import type { WhatsAppMessage } from "@/types";

export const PAGE_SIZES = [6, 12, 24] as const;
export function searchTerms(search: string) {
  // Treat a formatted phone number as one contiguous digit sequence.
  const query = search.trim().replace(/\s+/g, " ");
  return /^[+\d\s().-]+$/.test(query) && /\d/.test(query)
    ? [query.replace(/\D/g, "")]
    : query.toLowerCase().split(" ").filter(Boolean);
}
export function matchesSearch(row: WhatsAppMessage, search: string) {
  const fields = [row.recipient_name, row.message, row.full_phone].map((field) => field.toLowerCase());
  return searchTerms(search).every((term) => fields.some((field) => field.includes(term)));
}
export function searchFilter(term: string) {
  // Quote PostgREST values and escape LIKE wildcards so user input stays literal.
  const value = term.replace(/[\\%_*]/g, "\\$&").replace(/"/g, '\\"');
  return ["recipient_name", "message", "full_phone"].map((field) => `${field}.ilike."%${value}%"`).join(",");
}
export function pageBounds(page: number, size: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.min(page, pages));
  return { page: current, pages, start: (current - 1) * size, end: Math.min(current * size, total) };
}
