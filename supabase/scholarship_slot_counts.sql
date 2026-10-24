-- Lets students see how many slots are taken without being able to read other
-- students' grantee rows. Run once in the Supabase SQL editor.
create or replace function public.scholarship_slot_counts()
returns table (scholarship_id text, occupied bigint)
language sql
security definer
set search_path = public
as $$
  select g.scholarship_id::text, count(*)::bigint
  from public.grantees g
  where g.status = 'Active'
  group by g.scholarship_id;
$$;

grant execute on function public.scholarship_slot_counts() to authenticated;
