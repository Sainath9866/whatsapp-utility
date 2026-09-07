import { PAGE_SIZES, pageBounds } from "@/lib/message-search";

export default function Pagination({ page, size, total, busy, onPage, onSize }: {
  page: number; size: number; total: number; busy: boolean; onPage: (page: number) => void; onSize: (size: number) => void;
}) {
  const bounds = pageBounds(page, size, total);
  return <div className="mt-6 flex flex-col gap-4 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500"><span aria-live="polite">{total ? `${bounds.start + 1}–${bounds.end} of ${total}` : "0 results"}</span><label className="mb-0 flex items-center gap-2 text-xs font-normal">Per page<select aria-label="Messages per page" value={size} onChange={(event) => onSize(Number(event.target.value))} className="min-h-11 rounded-lg border border-stone-200 bg-white px-2 text-base">{PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <nav aria-label="Message pages" className="flex items-center justify-between gap-3"><button type="button" className="secondary" disabled={busy || bounds.page === 1} onClick={() => onPage(bounds.page - 1)}>← Previous</button><span className="text-sm tabular-nums text-stone-600">{bounds.page} / {bounds.pages}</span><button type="button" className="secondary" disabled={busy || bounds.page === bounds.pages} onClick={() => onPage(bounds.page + 1)}>Next →</button></nav>
  </div>;
}
