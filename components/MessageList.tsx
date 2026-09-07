"use client";

import { useEffect, useRef, useState } from "react";
import type { WhatsAppMessage } from "@/types";
import { deleteHistoryMessage, errorMessage, getMessagePage, getPendingMessage, markSent, restoreMessage, type MessagePage } from "@/lib/messages";
import Pagination from "./Pagination";
import MessageBody from "./MessageBody";
import WhatsAppHandoff from "./WhatsAppHandoff";

export default function MessageList({ status, revision, active, onChanged, onCompose }: {
  status: WhatsAppMessage["status"]; revision: number; active: boolean; onChanged: () => void; onCompose?: () => void;
}) {
  const history = status === "sent";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<MessagePage>({ messages: [], total: 0, page: 1 });
  const [settledView, setSettledView] = useState("");
  const [settledKey, setSettledKey] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<WhatsAppMessage | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const inFlight = useRef(new Set<string>());
  const top = useRef<HTMLHeadingElement>(null);
  const view = JSON.stringify([status, search, page, size]);
  const key = JSON.stringify([status, search, page, size, revision, retry]);
  const loading = settledKey !== key;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const data = await getMessagePage(status, search, page, size);
        if (!cancelled) { setResult(data); setFetchError(""); }
      } catch (error) {
        if (!cancelled) setFetchError(errorMessage(error));
      } finally { if (!cancelled) { setSettledKey(key); setSettledView(view); } }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active, key, page, search, size, status, view]);

  useEffect(() => {
    if (!prepared) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [prepared]);

  function navigate(next: number) {
    setPage(next);
    top.current?.scrollIntoView({ block: "start", behavior: "instant" });
    top.current?.focus({ preventScroll: true });
  }

  async function act(msg: WhatsAppMessage) {
    if (inFlight.current.has(msg.id)) return;
    setActionError(""); setNotice("");
    if (!history) {
      inFlight.current.add(msg.id); setBusy([...inFlight.current]);
      try {
        const latest = await getPendingMessage(msg.id);
        setResult((previous) => ({ ...previous, messages: previous.messages.map((row) => row.id === latest.id ? latest : row) }));
        setPrepared(latest);
      } catch (error) {
        setActionError(`Could not prepare the latest WhatsApp message: ${errorMessage(error)}`);
      } finally { inFlight.current.delete(msg.id); setBusy([...inFlight.current]); }
      return;
    }
    inFlight.current.add(msg.id); setBusy([...inFlight.current]);
    try {
      await restoreMessage(msg.id);
      setResult((previous) => ({ ...previous, messages: previous.messages.filter((row) => row.id !== msg.id), total: Math.max(0, previous.total - 1) }));
      setNotice(`${msg.recipient_name}’s message is back in the queue.`);
      setRetry((value) => value + 1);
      onChanged();
    } catch (error) {
      setActionError(`Could not restore message: ${errorMessage(error)}`);
    } finally { inFlight.current.delete(msg.id); setBusy([...inFlight.current]); }
  }

  async function completeHandoff(message: WhatsAppMessage) {
    if (inFlight.current.has(message.id)) return;
    inFlight.current.add(message.id); setBusy([...inFlight.current]);
    setActionError(""); setNotice("");
    // Start both operations during the direct link click. The link itself is
    // allowed to continue immediately so app-link handling remains an OS choice.
    const copy = copyMessage(message.message);
    const update = markSent(message.id);
    try {
      const [copied] = await Promise.all([copy, update]);
      setPrepared(null);
      setResult((previous) => ({ ...previous, messages: previous.messages.filter((row) => row.id !== message.id), total: Math.max(0, previous.total - 1) }));
      setNotice(copied
        ? `Opened the latest message for ${message.recipient_name}. If WhatsApp kept an old draft, select all and paste the copied text.`
        : `Opened the latest message for ${message.recipient_name}. Your browser blocked the backup copy, so verify the text before sending.`);
      setRetry((value) => value + 1);
      onChanged();
    } catch (error) {
      setPrepared(null);
      setActionError(`WhatsApp opened but the queue could not be updated: ${errorMessage(error)} Check the chat before opening it again.`);
    } finally { inFlight.current.delete(message.id); setBusy([...inFlight.current]); }
  }

  async function remove(msg: WhatsAppMessage) {
    if (inFlight.current.has(msg.id)) return;
    inFlight.current.add(msg.id); setBusy([...inFlight.current]);
    setActionError(""); setNotice("");
    try {
      await deleteHistoryMessage(msg.id);
      setConfirmDelete(null);
      setResult((previous) => ({ ...previous, messages: previous.messages.filter((row) => row.id !== msg.id), total: Math.max(0, previous.total - 1) }));
      setNotice(`Deleted ${msg.recipient_name}’s selected history message from the database.`);
      setRetry((value) => value + 1);
      onChanged();
    } catch (error) {
      setActionError(`Could not delete this history message: ${errorMessage(error)}`);
    } finally { inFlight.current.delete(msg.id); setBusy([...inFlight.current]); }
  }

  return <section aria-label={history ? "Message history" : "Send queue"}>
    <div className="mb-5 flex items-start justify-between gap-3"><div className="min-w-0"><h2 ref={top} tabIndex={-1} className="scroll-mt-5 text-lg font-semibold">{history ? "Message history" : "Ready to send"}</h2><p className="mt-1 text-sm text-stone-500">{history ? "Messages opened in WhatsApp." : "One conversation at a time."} Newest added first.</p></div><button type="button" className="secondary shrink-0" disabled={loading} onClick={() => { setRetry((value) => value + 1); onChanged(); }}>{loading ? "Loading…" : "↻ Refresh"}</button></div>
    <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{history ? "Opened does not confirm delivery. Check the WhatsApp conversation before moving a message back to avoid sending it twice." : "The app fetches and copies the latest saved text before opening WhatsApp. If WhatsApp preserves an old unsent draft, select all in its message box and paste the copied text. Then review it and press Send."}</p>
    <div className="mb-5"><label htmlFor={`${status}-search`}>{history ? "Search history" : "Search queue"}</label><div className="flex gap-2"><input id={`${status}-search`} type="search" maxLength={200} placeholder="Name, phone number, or message…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-describedby={`${status}-search-help`} />{search && <button type="button" className="secondary shrink-0" onClick={() => { setSearch(""); setPage(1); }}>Clear</button>}</div><p id={`${status}-search-help`} className="mt-2 text-xs text-stone-500">Searches all {history ? "history" : "pending messages"}, across every page.</p></div>
    {actionError && <p role="alert" className="notice error mb-5">{actionError}</p>}{notice && <p role="status" className="notice mb-5">{notice}</p>}
    {settledView !== view ? <div role="status" className="panel p-12 text-center text-stone-500">Finding messages…</div> : fetchError ? <div role="alert" className="notice error"><p>Could not load messages: {fetchError}</p><button type="button" className="secondary mt-3" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : !result.messages.length ? <div className="panel px-6 py-14 text-center"><h3 className="text-xl font-semibold">{search.trim() ? "No matching messages" : history ? "No history yet" : "All caught up"}</h3><p className="mt-2 text-sm text-stone-500">{search.trim() ? "Try a different name, number, or phrase." : history ? "Messages appear here after you open them from the queue." : "New messages will appear here when they’re added."}</p>{search.trim() ? <button type="button" className="secondary mt-5" onClick={() => { setSearch(""); setPage(1); }}>Clear search</button> : !history && <button type="button" className="primary mt-5" onClick={onCompose}>Add a message</button>}</div> : <div className="grid min-w-0 gap-5 md:grid-cols-2">{result.messages.map((msg) => <article key={msg.id} className="panel flex min-w-0 flex-col p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="[overflow-wrap:anywhere] font-semibold">{msg.recipient_name}</h3><p className="mt-1 text-sm text-stone-500">+{msg.country_code} {msg.phone_number}</p></div><span className={`rounded-full px-3 py-1 text-[11px] font-medium ${history ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{history ? "Opened in WhatsApp" : "Pending"}</span></div><div className="my-5 rounded-xl bg-stone-50 p-4"><MessageBody text={msg.message} /></div><div className="mt-auto border-t border-stone-100 pt-4"><div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><span className="text-xs text-stone-500">Added <time dateTime={msg.created_at}>{new Date(msg.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></span>{history ? <div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" className="secondary text-red-700" disabled={busy.includes(msg.id)} onClick={() => setConfirmDelete(msg.id)}>Delete</button><button type="button" className="secondary" disabled={busy.includes(msg.id)} onClick={() => void act(msg)}>Move back to queue</button></div> : <button type="button" className="primary" disabled={busy.includes(msg.id)} onClick={() => void act(msg)}>{busy.includes(msg.id) ? "Fetching latest…" : "Review & open WhatsApp"}</button>}</div>{history && confirmDelete === msg.id && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-semibold text-red-900">Delete only this history message?</p><p className="mt-1 text-xs leading-5 text-red-800">This permanently removes this row from the database. Other messages for this recipient stay untouched.</p><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="secondary" disabled={busy.includes(msg.id)} onClick={() => setConfirmDelete(null)}>Cancel</button><button type="button" className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60" disabled={busy.includes(msg.id)} onClick={() => void remove(msg)}>{busy.includes(msg.id) ? "Deleting…" : "Delete permanently"}</button></div></div>}</div></article>)}</div>}
    {!fetchError && <Pagination page={result.page} size={size} total={result.total} busy={loading} onPage={navigate} onSize={(value) => { setSize(value); setPage(1); }} />}
    {prepared && <WhatsAppHandoff message={prepared} busy={busy.includes(prepared.id)} onCancel={() => setPrepared(null)} onCopy={() => { void copyMessage(prepared.message).then((copied) => setNotice(copied ? "Latest message copied." : "Your browser did not allow copying.")); }} onOpen={() => void completeHandoff(prepared)} />}
  </section>;
}

async function copyMessage(message: string) {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = message;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}
