import type { WhatsAppMessage } from "@/types";

export function normalizeWhatsAppText(text: string) {
  // WhatsApp bold uses one asterisk on each side. Collapse Markdown-style
  // double (or longer) runs immediately so **word** becomes *word*.
  return text.replace(/\*{2,}/g, "*");
}

export function buildWhatsAppUrl(message: Pick<WhatsAppMessage, "full_phone" | "message">) {
  // WhatsApp documents wa.me as its cross-platform click-to-chat URL. Keeping
  // this as a plain HTTPS link lets each OS/browser use its registered app-link
  // handler or fall back to WhatsApp's web page when the app is unavailable.
  const url = new URL(`https://wa.me/${message.full_phone}/`);
  url.searchParams.set("text", normalizeWhatsAppText(message.message));
  return url.toString();
}
