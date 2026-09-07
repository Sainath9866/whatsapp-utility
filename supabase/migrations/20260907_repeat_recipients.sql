-- A message is identified by its UUID, not its recipient's phone number.
-- Removes only simple uniqueness rules built from phone/country/status columns.
-- Preserves all rows, the primary key, and unrelated uniqueness rules.
begin;
do $$
declare
  item record;
begin
  for item in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.whatsapp_messages'::regclass
      and c.contype = 'u'
      and exists (
        select 1 from unnest(c.conkey) k(attnum)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
        where a.attname in ('phone_number', 'full_phone')
      )
      and not exists (
        select 1 from unnest(c.conkey) k(attnum)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
        where a.attname not in ('phone_number', 'full_phone', 'country_code', 'status')
      )
  loop
    execute format('alter table public.whatsapp_messages drop constraint %I', item.conname);
  end loop;

  -- Also handle standalone UNIQUE indexes, including partial pending indexes.
  for item in
    select ns.nspname, idx.relname
    from pg_index i
    join pg_class idx on idx.oid = i.indexrelid
    join pg_namespace ns on ns.oid = idx.relnamespace
    where i.indrelid = 'public.whatsapp_messages'::regclass
      and i.indisunique and not i.indisprimary
      and i.indexprs is null
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
      and exists (
        select 1 from unnest(i.indkey) with ordinality k(attnum, position)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where k.position <= i.indnkeyatts and a.attname in ('phone_number', 'full_phone')
      )
      and not exists (
        select 1 from unnest(i.indkey) with ordinality k(attnum, position)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where k.position <= i.indnkeyatts and a.attname not in ('phone_number', 'full_phone', 'country_code', 'status')
      )
  loop
    execute format('drop index %I.%I', item.nspname, item.relname);
  end loop;
end $$;
commit;
