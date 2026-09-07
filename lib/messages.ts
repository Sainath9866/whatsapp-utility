import type { MessageInput, WhatsAppMessage } from "@/types";
import { supabase } from "./supabase";
import { matchesSearch, pageBounds, PAGE_SIZES, searchFilter, searchTerms } from "./message-search";
import { normalizeWhatsAppText } from "./whatsapp";

export const STORAGE_KEY = "whatsapp-queue:v1";
export const LOCAL_CHANGE = "whatsapp-queue-change";

export function normalizeInput(input: Omit<MessageInput, "full_phone">): MessageInput {
  const recipient_name = input.recipient_name.trim();
  const country_code = input.country_code.replace(/\D/g, "");
  const phone_number = input.phone_number.replace(/\D/g, "");
  const message = normalizeWhatsAppText(input.message);
  const full_phone = country_code + phone_number;
  if (!recipient_name || recipient_name.length > 100) throw new Error("Enter a recipient name of 1–100 characters.");
  if (!/^[1-9]\d{0,2}$/.test(country_code)) throw new Error("Enter a valid country code (1–3 digits).");
  if (!/^\d{4,14}$/.test(phone_number) || !/^[1-9]\d{6,14}$/.test(full_phone)) throw new Error("Enter a valid international phone number with 7–15 digits including the country code.");
  if (!message.trim() || message.length > 4000) throw new Error("Enter a message of 1–4,000 characters.");
  return { recipient_name, country_code, phone_number, full_phone, message };
}

function readLocal(): WhatsAppMessage[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || !rows.every((row) =>
    row && typeof row.id === "string" && typeof row.created_at === "string" &&
    !Number.isNaN(Date.parse(row.created_at)) && typeof row.recipient_name === "string" &&
    typeof row.message === "string" && typeof row.country_code === "string" &&
    typeof row.phone_number === "string" && typeof row.full_phone === "string" &&
    /^[1-9]\d{6,14}$/.test(row.full_phone) && ["pending", "sent"].includes(row.status)
  )) throw new Error("Saved queue data could not be read. Your browser data has been preserved.");
  return rows;
}

function writeLocal(rows: WhatsAppMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(LOCAL_CHANGE));
}

export async function getPending(): Promise<WhatsAppMessage[]> {
  if (!supabase) return readLocal().filter((row) => row.status === "pending").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase.from("whatsapp_messages").select("*").eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getHistory(): Promise<WhatsAppMessage[]> {
  if (!supabase) return readLocal().filter((row) => row.status === "sent").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase.from("whatsapp_messages").select("*").eq("status", "sent").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function restoreMessage(id: string) {
  if (!supabase) {
    const rows = readLocal();
    if (!rows.some((row) => row.id === id && row.status === "sent")) throw new Error("This message is no longer in history. Refresh and try again.");
    writeLocal(rows.map((row) => row.id === id ? { ...row, status: "pending" } : row));
    return;
  }
  const { data, error } = await supabase.from("whatsapp_messages").update({ status: "pending" }).eq("id", id).eq("status", "sent").select("id");
  if (error) throw error;
  if (!data.length) throw new Error("The message could not be restored. Refresh and check that the history migration has been applied.");
}

export async function deleteHistoryMessage(id: string) {
  if (!supabase) {
    const rows = readLocal();
    if (!rows.some((row) => row.id === id && row.status === "sent")) throw new Error("This message is no longer in history. Refresh and try again.");
    writeLocal(rows.filter((row) => row.id !== id));
    return;
  }
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .delete()
    .eq("id", id)
    .eq("status", "sent")
    .select("id");
  if (error) throw error;
  if (!data.length) throw new Error("The message could not be deleted. Refresh and check that the history-delete migration has been applied.");
}

export async function addMessage(input: MessageInput) {
  const valid = normalizeInput(input);
  if (!supabase) {
    writeLocal([{ ...valid, id: crypto.randomUUID(), status: "pending", created_at: new Date().toISOString() }, ...readLocal()]);
    return;
  }
  // Each submission creates a message row. Never upsert/deduplicate by phone.
  const { error } = await supabase.from("whatsapp_messages").insert({ ...valid, status: "pending" }).select("id").single();
  if (error?.code === "23505") throw new Error("The database rejected this new message because of a uniqueness rule. Repeated phone numbers should be allowed; apply the repeat-recipient migration. Your draft has been kept.");
  if (error) throw error;
}

export async function markSent(id: string) {
  if (!supabase) {
    writeLocal(readLocal().map((row) => row.id === id ? { ...row, status: "sent" } : row));
    return;
  }
  const { data, error } = await supabase.from("whatsapp_messages").update({ status: "sent" }).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw new Error("The message could not be updated. Refresh the queue and try again.");
}

export async function getPendingMessage(id: string): Promise<WhatsAppMessage> {
  if (!supabase) {
    const row = readLocal().find((message) => message.id === id && message.status === "pending");
    if (!row) throw new Error("This message is no longer pending. Refresh the queue and try again.");
    return row;
  }
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();
  if (error?.code === "PGRST116") throw new Error("This message is no longer pending. Refresh the queue and try again.");
  if (error) throw error;
  return data;
}

export function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error ? String(error.message) : "Something went wrong. Please try again.";
}

export type MessagePage = { messages: WhatsAppMessage[]; total: number; page: number };

export async function getMessagePage(status: WhatsAppMessage["status"], search: string, page: number, size: number): Promise<MessagePage> {
  if (!PAGE_SIZES.some((allowed) => allowed === size) || !Number.isInteger(page) || page < 1) throw new Error("Invalid page requested.");
  if (!supabase) {
    const rows = readLocal().filter((row) => row.status === status && matchesSearch(row, search))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const bounds = pageBounds(page, size, rows.length);
    return { messages: rows.slice(bounds.start, bounds.end), total: rows.length, page: bounds.page };
  }
  let query = supabase.from("whatsapp_messages").select("*", { count: "exact" }).eq("status", status);
  for (const term of searchTerms(search)) query = query.or(searchFilter(term));
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (error) {
    // PostgREST can return 416 instead of an empty page after concurrent removals.
    if (error.code === "PGRST103" && page > 1) {
      let recount = supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", status);
      for (const term of searchTerms(search)) recount = recount.or(searchFilter(term));
      const fresh = await recount;
      if (fresh.error) throw fresh.error;
      const last = pageBounds(page, size, fresh.count ?? 0).page;
      if (last < page) return getMessagePage(status, search, last, size);
    }
    throw error;
  }
  const total = count ?? 0;
  const bounds = pageBounds(page, size, total);
  // An item can leave the last page while this screen is open.
  if (bounds.page !== page) return getMessagePage(status, search, bounds.page, size);
  return { messages: data, total, page };
}

export async function getPendingCount(): Promise<number> {
  if (!supabase) return readLocal().filter((row) => row.status === "pending").length;
  const { count, error } = await supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}
