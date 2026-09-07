"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveTab } from "@/types";
import { supabase } from "@/lib/supabase";
import { errorMessage, getPendingCount, LOCAL_CHANGE, STORAGE_KEY } from "@/lib/messages";
import Navbar from "./Navbar";
import AddMessageForm from "./AddMessageForm";
import SendQueueList from "./SendQueueList";
import HistoryList from "./HistoryList";

export default function QueueApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("add");
  const [pendingCount, setPendingCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(supabase ? "Connecting" : "Local mode");
  const request = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setRevision((value) => value + 1);
    try {
      const count = await getPendingCount();
      if (mounted.current && current === request.current) { setPendingCount(count); setError(""); }
    } catch (error) {
      if (mounted.current && current === request.current) setError(errorMessage(error));
    } finally {
      if (mounted.current && current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const reload = () => { void refresh(); };
    const storageChanged = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) reload(); };
    const initial = window.setTimeout(reload, 0);
    window.addEventListener("storage", storageChanged);
    window.addEventListener(LOCAL_CHANGE, reload);
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    const channel = supabase?.channel("whatsapp-queue").on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, reload).subscribe((status) => {
      if (!mounted.current) return;
      setConnection(status === "SUBSCRIBED" ? "Live sync" : "Reconnecting");
      if (status === "SUBSCRIBED") reload();
    });
    // A small polling fallback also catches changes after a dropped realtime event.
    const poll = supabase ? window.setInterval(reload, 30_000) : undefined;
    return () => {
      mounted.current = false;
      window.clearTimeout(initial); window.clearInterval(poll);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener(LOCAL_CHANGE, reload);
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [refresh]);

  return <div className="min-h-screen">
    <header className="border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-800 text-white"><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 11h8M8 14h5"/></svg></span><div><p className="text-lg font-semibold tracking-tight">Little Queue<span className="text-emerald-600">.</span></p><p className="text-[10px] tracking-widest text-stone-400">A WHATSAPP WORKSPACE</p></div></div><span role="status" className="flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-600"><span className={`size-1.5 rounded-full ${connection === "Live sync" ? "bg-emerald-500" : "bg-amber-500"}`} />{connection}</span></div></header>
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14"><div className="mb-9 flex items-end justify-between gap-5"><div><p className="mb-3 text-xs font-medium tracking-[0.16em] text-emerald-800">LESS ADMIN. MORE CONNECTION.</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good conversations start here.</h1><p className="mt-3 text-sm leading-6 text-stone-500 sm:text-base">Prepare a message. Pass it along. Make someone’s day.</p></div><div className="hidden text-right sm:block"><p className="text-3xl font-semibold text-emerald-900">{loading && !pendingCount ? "—" : pendingCount}</p><p className="mt-1 text-xs text-stone-500">messages pending</p></div></div>
      {!supabase && <p className="mb-6 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs leading-5 text-stone-600">You’re in local mode. Messages stay in this browser. Connect Supabase to share the queue across devices; local messages are not automatically transferred.</p>}
      {error && <div role="alert" className="notice error mb-6 flex flex-wrap items-center justify-between gap-3"><p>Could not refresh messages: {error}</p><button type="button" className="underline" onClick={() => void refresh()}>Try again</button></div>}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount} />
      <div hidden={activeTab !== "add"}><AddMessageForm onAdded={() => void refresh()} /></div>
      <div hidden={activeTab !== "queue"}><SendQueueList revision={revision} active={activeTab === "queue"} onChanged={() => void refresh()} onCompose={() => setActiveTab("add")} /></div>
      <div hidden={activeTab !== "history"}><HistoryList revision={revision} active={activeTab === "history"} onChanged={() => void refresh()} /></div>
      <footer className="mt-12 border-t border-stone-200 pt-5 text-xs text-stone-400"><span>A little queue for thoughtful messages.</span></footer>
    </main>
  </div>;
}
