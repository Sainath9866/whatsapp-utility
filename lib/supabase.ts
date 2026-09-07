import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// An unconfigured app works locally; configured connection failures never
// silently redirect shared messages into browser storage.
export const supabase = url && key
  ? createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
