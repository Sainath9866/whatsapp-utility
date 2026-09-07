"use client";

import { useRef, useState, type FormEvent } from "react";
import MessageEditor from "./MessageEditor";
import MessageText from "./MessageText";
import { addMessage, errorMessage, normalizeInput } from "@/lib/messages";
import { normalizeWhatsAppText } from "@/lib/whatsapp";

export default function AddMessageForm({ onAdded }: { onAdded: () => void }) {
  const [recipientName, setRecipientName] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(""); setSuccess(""); setSaving(true);
    try {
      await addMessage(normalizeInput({ recipient_name: recipientName, country_code: countryCode, phone_number: phoneNumber, message }));
      setRecipientName(""); setCountryCode("91"); setPhoneNumber(""); setMessage("");
      setSuccess("Message added. It’s ready in the send queue.");
      onAdded();
    } catch (error) { setError(errorMessage(error)); }
    finally { inFlight.current = false; setSaving(false); }
  }

  return <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
    <section className="panel min-w-0">
      <div className="border-b border-stone-100 p-6 sm:px-8"><h2 className="text-lg font-semibold">Compose a message</h2><p className="mt-1 text-sm text-stone-500">A little preparation. A more personal conversation.</p></div>
      <form onSubmit={submit} className="space-y-6 p-4 sm:p-8">
        <fieldset disabled={saving} className="min-w-0 space-y-6">
          <div><label htmlFor="recipient">Recipient name</label><input id="recipient" autoComplete="name" placeholder="e.g. Priya Sharma" required maxLength={100} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></div>
          <div className="grid grid-cols-[100px_1fr] gap-3 sm:grid-cols-[130px_1fr]">
            <div><label htmlFor="country">Country code</label><input id="country" inputMode="tel" autoComplete="tel-country-code" required placeholder="91" maxLength={5} value={countryCode} onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, ""))} /></div>
            <div><label htmlFor="phone">Phone number</label><input id="phone" inputMode="tel" autoComplete="tel-national" required placeholder="98765 43210" maxLength={24} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))} /></div>
          </div>
          <p className="-mt-3 text-xs text-stone-500">Use the recipient’s WhatsApp number, without the country code or leading local zero.</p>
          <MessageEditor value={message} onChange={(value) => setMessage(normalizeWhatsAppText(value))} />
        </fieldset>
        {error && <p role="alert" className="notice error">{error}</p>}
        {success && <p role="status" className="notice">{success}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-6"><span className="text-xs text-stone-500">Ready for the send queue</span><button disabled={saving || message.length > 4000} className="primary w-full sm:w-auto" type="submit">{saving ? "Adding…" : "Add to queue"}<span aria-hidden="true">↗</span></button></div>
      </form>
    </section>
    <aside className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-2xl border border-stone-200"><div className="flex items-center justify-between bg-white px-5 py-4"><h2 className="text-sm font-semibold">Message preview</h2><span className="text-[10px] font-medium tracking-widest text-stone-400">WHATSAPP</span></div><div className="preview-bg min-h-72 p-4 sm:p-6"><div className="mb-6 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-white/80 text-sm font-semibold text-emerald-800">{recipientName.trim().slice(0, 1).toUpperCase() || "?"}</span><div className="min-w-0 [overflow-wrap:anywhere]"><p className="text-sm font-semibold">{recipientName.trim() || "Your recipient"}</p><p className="text-xs text-stone-500">{phoneNumber ? `+${countryCode} ${phoneNumber}` : "WhatsApp conversation"}</p></div></div><div className="min-w-0 sm:ml-5 rounded-xl rounded-tr-none bg-[#d9f8c6] p-4 shadow-sm"><MessageText text={message || "Your message will appear here as you type. Say hello!"} /><p className="mt-2 text-right text-[10px] text-emerald-700">Formatting preview <span aria-hidden="true">✓✓</span></p></div></div></section>
      <section className="px-2"><h3 className="mb-4 text-sm font-semibold">From draft to conversation</h3><ol className="space-y-4">{[["01", "Add a message", "Enter the recipient and write a personal note."], ["02", "Open the send queue", "Every pending message, together in one place."], ["03", "Send it in WhatsApp", "Open the chat, review, and press Send."]].map(([number, title, detail]) => <li key={number} className="flex gap-3"><span className="pt-0.5 font-mono text-xs text-emerald-700">{number}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{detail}</p></div></li>)}</ol></section>
    </aside>
  </div>;
}
