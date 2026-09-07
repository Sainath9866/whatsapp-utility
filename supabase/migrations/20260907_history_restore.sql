-- Allow the existing zero-auth queue to restore a history item to pending.
-- No data or columns are changed.
drop policy if exists "Restore messages to queue" on public.whatsapp_messages;
create policy "Restore messages to queue"
  on public.whatsapp_messages for update to anon
  using (status = 'sent') with check (status = 'pending');
