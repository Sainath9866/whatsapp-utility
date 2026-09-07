-- Run in the Supabase SQL Editor for a new project.
-- This is intentionally a zero-auth shared queue: anyone with the public
-- project credentials can read recipients/messages, add rows, and mark sent.
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null check (char_length(btrim(recipient_name)) between 1 and 100),
  country_code text not null check (country_code ~ '^[1-9][0-9]{0,2}$'),
  phone_number text not null check (phone_number ~ '^[0-9]{4,14}$'),
  full_phone text not null check (full_phone ~ '^[1-9][0-9]{6,14}$' and full_phone = country_code || phone_number),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending', 'sent')),
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_pending_created_at on public.whatsapp_messages (created_at desc) where status = 'pending';
alter table public.whatsapp_messages enable row level security;
revoke all on public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_messages to anon;
grant insert (recipient_name, country_code, phone_number, full_phone, message, status) on public.whatsapp_messages to anon;
grant update (status) on public.whatsapp_messages to anon;
grant delete on public.whatsapp_messages to anon;
drop policy if exists "Read shared queue" on public.whatsapp_messages;
create policy "Read shared queue" on public.whatsapp_messages for select to anon using (true);
drop policy if exists "Add pending messages" on public.whatsapp_messages;
create policy "Add pending messages" on public.whatsapp_messages for insert to anon with check (status = 'pending');
drop policy if exists "Mark pending messages sent" on public.whatsapp_messages;
create policy "Mark pending messages sent" on public.whatsapp_messages for update to anon using (status = 'pending') with check (status = 'sent');
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_messages') then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;
end $$;
-- Allow the existing zero-auth queue to restore a history item to pending.
-- No data or columns are changed.
drop policy if exists "Restore messages to queue" on public.whatsapp_messages;
create policy "Restore messages to queue"
  on public.whatsapp_messages for update to anon
  using (status = 'sent') with check (status = 'pending');
drop policy if exists "Delete individual history messages" on public.whatsapp_messages;
create policy "Delete individual history messages"
  on public.whatsapp_messages for delete to anon
  using (status = 'sent');
