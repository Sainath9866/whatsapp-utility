-- Permit permanent deletion of individual history rows only.
-- The application targets one UUID and status = 'sent' per request.
grant delete on public.whatsapp_messages to anon;

drop policy if exists "Delete individual history messages" on public.whatsapp_messages;
create policy "Delete individual history messages"
  on public.whatsapp_messages for delete to anon
  using (status = 'sent');
