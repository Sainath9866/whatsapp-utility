"use client";

import type { WhatsAppMessage } from "@/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import MessageBody from "./MessageBody";

export default function WhatsAppHandoff({ message, busy, onCancel, onOpen, onCopy }: {
  message: WhatsAppMessage;
  busy: boolean;
  onCancel: () => void;
  onOpen: () => void;
  onCopy: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="whatsapp-handoff-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-7" onKeyDown={(event) => { if (event.key === "Escape" && !busy) onCancel(); }}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-widest text-emerald-700">LATEST SAVED MESSAGE</p><h2 id="whatsapp-handoff-title" className="mt-2 text-xl font-semibold">Open chat with {message.recipient_name}?</h2><p className="mt-1 text-sm text-stone-500">+{message.country_code} {message.phone_number}</p></div><button type="button" aria-label="Close WhatsApp review" className="min-h-11 min-w-11 rounded-lg text-xl text-stone-500 hover:bg-stone-100" disabled={busy} onClick={onCancel}>×</button></div>
      <div className="my-5 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-4"><MessageBody text={message.message} /></div>
      <p className="text-xs leading-5 text-stone-500">This direct WhatsApp link can open the installed app on macOS, Windows, Android, and iOS. Your browser or operating-system preference may show WhatsApp’s web handoff page instead.</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="secondary" disabled={busy} onClick={onCopy}>Copy message</button><a autoFocus href={buildWhatsAppUrl(message)} target="_blank" rel="noopener noreferrer" className="primary text-center" aria-disabled={busy} onClick={(event) => { if (busy) { event.preventDefault(); return; } onOpen(); }}>Open WhatsApp ↗</a></div>
    </section>
  </div>;
}
